"""Result envelope, error codes, and exception normalization.

Every response speaks one shape:
  success  {"ok": true, "data": ...}
  failure  {"ok": false, "error": {"code": ..., "message": ...}}
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

CODE_STATUS: dict[str, int] = {
    "unauthorized": 401,
    "validation_error": 422,
    "not_found": 404,
    "conflict": 409,
    "rejected": 409,
    "offline": 503,
    "timeout": 504,
    "unknown_error": 500,
}


class AppError(Exception):
    def __init__(self, code: str, message: str, details: Any = None):
        super().__init__(message)
        if code not in CODE_STATUS:
            raise ValueError(f"Unknown error code {code!r}.")
        self.code = code
        self.message = message
        self.details = details

    @property
    def status(self) -> int:
        return CODE_STATUS[self.code]


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return str(value)


def ok_envelope(data: Any) -> dict[str, Any]:
    return {"ok": True, "data": data}


def error_envelope(code: str, message: str, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {"ok": False, "error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = _jsonable(details)
    return body


def not_found(message: str) -> AppError:
    return AppError("not_found", message)


def validation_error(message: str, details: Any = None) -> AppError:
    return AppError("validation_error", message, details)


def conflict(message: str) -> AppError:
    return AppError("conflict", message)


def validated(schema, data):
    """Manual model_validate that speaks the envelope instead of raising raw."""
    try:
        return schema.model_validate(data)
    except Exception as exc:
        details = exc.errors() if hasattr(exc, "errors") else str(exc)
        raise AppError(
            "validation_error", "Request validation failed.", details
        ) from exc


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content=error_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        try:
            details = exc.errors()
        except TypeError:
            details = str(exc)
        return JSONResponse(
            status_code=422,
            content=error_envelope(
                "validation_error", "Request validation failed.", details
            ),
        )

    @app.exception_handler(HTTPException)
    async def _http(_request: Request, exc: HTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "unknown_error"
        return JSONResponse(
            status_code=exc.status_code,
            content=error_envelope(code, str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def _unexpected(_request: Request, _exc: Exception) -> JSONResponse:
        # Internal details stay out of the response.
        return JSONResponse(
            status_code=500,
            content=error_envelope("unknown_error", "Unexpected server failure."),
        )

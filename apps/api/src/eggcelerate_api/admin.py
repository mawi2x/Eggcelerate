"""Interactive operator commands for owner accounts and device provisioning."""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import UTC, datetime
from getpass import getpass
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .auth_security import hash_password
from .config import Settings, load_settings
from .database.accounts import create_farm_owner
from .database.device_registry import provision_device
from .database.schema import auth_rate_limits, auth_sessions, users
from .database.store import PostgresStore
from .errors import AppError


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m eggcelerate_api.admin")
    commands = parser.add_subparsers(dest="command", required=True)
    create_owner = commands.add_parser(
        "create-owner", help="create an owner account and a new empty farm"
    )
    create_owner.add_argument("--email", required=True)
    create_owner.add_argument("--name", required=True)
    create_owner.add_argument("--farm", required=True)
    reset_password = commands.add_parser(
        "reset-password", help="set a new password and revoke current sessions"
    )
    reset_password.add_argument("--email", required=True)
    provision = commands.add_parser(
        "provision-device", help="reserve one commissioned device ID for a farm"
    )
    provision.add_argument("--farm-id", required=True)
    provision.add_argument("--device-id", required=True)
    return parser


async def _create_owner(
    database: PostgresStore, args: argparse.Namespace, password: str
) -> tuple[str, str]:
    from .api.v1.auth import RegisterRequest

    body = RegisterRequest(
        email=args.email,
        password=password,
        display_name=args.name,
        farm_name=args.farm,
    )
    user_id = uuid4()
    farm_id = uuid4()
    password_hash = await asyncio.to_thread(hash_password, body.password)
    try:
        async with database.sessions.begin() as session:
            await create_farm_owner(
                session,
                user_id=user_id,
                farm_id=farm_id,
                email=body.email,
                password_hash=password_hash,
                display_name=body.display_name,
                farm_name=body.farm_name,
            )
    except IntegrityError as exc:
        raise AppError(
            "conflict", "An account with this email already exists."
        ) from exc
    except (SQLAlchemyError, OSError, TimeoutError) as exc:
        raise AppError("offline", "The account service is unavailable.") from exc
    return str(user_id), str(farm_id)


async def _reset_password(
    database: PostgresStore, email: str, password: str, settings: Settings
) -> None:
    from .api.v1.auth import LoginRequest, login_bucket_hash

    normalized_email = LoginRequest(email=email, password=password).email
    if not 12 <= len(password) <= 128:
        raise AppError("validation_error", "Password must be 12 to 128 characters.")
    password_hash = await asyncio.to_thread(hash_password, password)
    bucket_hash = login_bucket_hash(settings, normalized_email)
    now = datetime.now(UTC)
    async with database.sessions.begin() as session:
        user_id = await session.scalar(
            select(users.c.id).where(users.c.email == normalized_email)
        )
        if user_id is None:
            raise AppError("not_found", "Account was not found.")
        await session.execute(
            update(users)
            .where(users.c.id == user_id)
            .values(password_hash=password_hash)
        )
        await session.execute(
            update(auth_sessions)
            .where(
                auth_sessions.c.user_id == user_id,
                auth_sessions.c.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        await session.execute(
            auth_rate_limits.delete().where(
                auth_rate_limits.c.bucket_hash == bucket_hash
            )
        )


async def _run(args: argparse.Namespace) -> None:
    settings = load_settings()
    if settings.auth_mode != "sessions":
        raise RuntimeError(
            "Operator account/device commands require AUTH_MODE=sessions."
        )
    if settings.storage_backend != "postgres_incubators" or not settings.database_url:
        raise RuntimeError(
            "Operator account/device commands require PostgreSQL storage."
        )
    database = PostgresStore(settings.database_url, settings.default_farm_id)
    try:
        if args.command == "create-owner":
            password = getpass("New password (12–128 characters): ")
            confirm = getpass("Confirm password: ")
            if password != confirm:
                raise AppError("validation_error", "Passwords do not match.")
            user_id, farm_id = await _create_owner(database, args, password)
            print(f"Created owner {user_id} with farm {farm_id}.")
        elif args.command == "reset-password":
            password = getpass("New password (12–128 characters): ")
            confirm = getpass("Confirm password: ")
            if password != confirm:
                raise AppError("validation_error", "Passwords do not match.")
            await _reset_password(database, args.email, password, settings)
            print("Password updated; all active sessions revoked.")
        else:
            provision_farm_id = UUID(args.farm_id)
            async with database.sessions.begin() as session:
                created = await provision_device(
                    session, provision_farm_id, args.device_id
                )
            state = "Provisioned" if created else "Already provisioned"
            print(f"{state} device {args.device_id} for farm {provision_farm_id}.")
    finally:
        await database.close()


def main() -> None:
    args = _parser().parse_args()
    try:
        asyncio.run(_run(args))
    except (AppError, SQLAlchemyError, OSError, TimeoutError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()

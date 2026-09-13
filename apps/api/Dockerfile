FROM python:3.13-slim
WORKDIR /srv/api
COPY apps/api/pyproject.toml ./
COPY apps/api/src/ ./src/
RUN pip install --no-cache-dir .
COPY apps/api/alembic.ini ./
COPY apps/api/migrations/ ./migrations/
EXPOSE 8000
CMD ["uvicorn", "eggcelerate_api.main:app", "--host", "0.0.0.0", "--port", "8000"]

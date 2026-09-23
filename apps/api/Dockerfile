FROM python:3.14-slim
WORKDIR /srv/api
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
COPY apps/api/pyproject.toml ./
COPY apps/api/src/ ./src/
RUN pip install --no-cache-dir .
COPY apps/api/alembic.ini ./
COPY apps/api/migrations/ ./migrations/
USER 10001:10001
EXPOSE 8000
CMD ["uvicorn", "eggcelerate_api.main:app", "--host", "0.0.0.0", "--port", "8000"]

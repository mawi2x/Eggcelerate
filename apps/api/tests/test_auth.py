"""Cookie sessions and farm scope are enforced through the HTTP boundary."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import update

from eggcelerate_api.auth_security import secret_hash
from eggcelerate_api.config import Settings
from eggcelerate_api.database.device_registry import provision_device
from eggcelerate_api.database.schema import auth_sessions
from eggcelerate_api.database.store import PostgresStore
from eggcelerate_api.main import create_app


def _register(client: TestClient, suffix: str, *, secure: bool = False) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"{suffix}@example.test",
            "password": "correct horse battery staple",
            "display_name": f"Farmer {suffix}",
            "farm_name": f"Farm {suffix}",
        },
    )
    assert response.status_code == 201, response.text
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert ("secure" in cookie) is secure
    assert "samesite=lax" in cookie
    assert "path=/api/v1" in cookie
    return response.json()["data"]


def test_sessions_enforce_tenant_scope_csrf_logout_and_expiry(settings):
    auth_settings = Settings(
        app_env="test",
        auth_mode="sessions",
        storage_backend="postgres_incubators",
        database_url=settings.database_url,
        default_farm_id=str(uuid4()),
        cors_origins=("http://testserver",),
    )
    app_a = create_app(auth_settings)
    app_b = create_app(auth_settings)
    with (
        TestClient(app_a, base_url="https://testserver") as client_a,
        TestClient(app_b, base_url="https://testserver") as client_b,
    ):
        assert client_a.get("/api/v1/incubators").status_code == 401
        blocked_origin = client_a.post(
            "/api/v1/auth/register",
            json={
                "email": f"origin-{uuid4().hex[:8]}@example.test",
                "password": "correct horse battery staple",
                "display_name": "Farm Owner",
                "farm_name": "Origin Check Farm",
            },
            headers={"Origin": "https://attacker.example"},
        )
        assert blocked_origin.status_code == 401
        suffix_a = f"phase8-{uuid4().hex[:8]}"
        suffix_b = f"phase8-{uuid4().hex[:8]}"
        identity_a = _register(client_a, suffix_a)
        identity_b = _register(client_b, suffix_b)
        device_a = f"EGG-{uuid4().hex[:16].upper()}"
        device_b = f"EGG-{uuid4().hex[:16].upper()}"

        async def provision_devices() -> None:
            database = PostgresStore(settings.database_url, settings.default_farm_id)
            try:
                async with database.sessions.begin() as session:
                    await provision_device(
                        session, UUID(identity_a["farm"]["id"]), device_a
                    )
                    await provision_device(
                        session, UUID(identity_b["farm"]["id"]), device_b
                    )
            finally:
                await database.close()

        asyncio.run(provision_devices())
        token_a = client_a.cookies.get("egg_session")
        token_b = client_b.cookies.get("egg_session")
        assert token_a and token_b and token_a != token_b
        hydrated = client_a.get("/api/v1/auth/session").json()["data"]
        assert hydrated["user"]["id"] == identity_a["user"]["id"]
        assert hydrated["farm"]["id"] == identity_a["farm"]["id"]
        assert hydrated["registration_enabled"] is True
        assert client_a.get("/readyz").json()["ready"] is True
        assert client_a.get("/api/v1/incubators").json()["data"] == []

        modes_a = client_a.get("/api/v1/modes").json()["data"]
        mode_id = modes_a[0]["id"]
        chamber = {
            "name": "Farm A chamber",
            "device_id": device_a,
            "mode_id": mode_id,
        }
        no_csrf = client_a.post("/api/v1/incubators", json=chamber)
        assert no_csrf.status_code == 401

        headers_a = {"X-CSRF-Token": identity_a["csrf_token"]}
        headers_b = {"X-CSRF-Token": identity_b["csrf_token"]}
        created_a = client_a.post(
            "/api/v1/incubators",
            json=chamber,
            headers={**headers_a, "Idempotency-Key": "shared-create-key"},
        )
        assert created_a.status_code == 201, created_a.text
        chamber_a = created_a.json()["data"]

        unprovisioned = client_a.post(
            "/api/v1/incubators",
            json={
                "name": "Unknown device",
                "device_id": "EGG-UNPROVISIONED",
                "mode_id": mode_id,
            },
            headers={**headers_a, "Idempotency-Key": "unprovisioned-device"},
        )
        assert unprovisioned.status_code == 409
        assert unprovisioned.json()["error"]["code"] == "rejected"

        created_b = client_b.post(
            "/api/v1/incubators",
            json={
                "name": "Farm B chamber",
                "device_id": device_b,
                "mode_id": client_b.get("/api/v1/modes").json()["data"][0]["id"],
            },
            headers={**headers_b, "Idempotency-Key": "shared-create-key"},
        )
        assert created_b.status_code == 201, created_b.text
        assert created_b.json()["data"]["id"] != chamber_a["id"]
        foreign_device = client_b.post(
            "/api/v1/incubators",
            json={
                "name": "Foreign device",
                "device_id": device_a,
                "mode_id": client_b.get("/api/v1/modes").json()["data"][0]["id"],
            },
            headers={**headers_b, "Idempotency-Key": "foreign-device"},
        )
        assert foreign_device.status_code == 409
        assert client_b.get(f"/api/v1/incubators/{chamber_a['id']}").status_code == 404
        assert (
            client_b.get(f"/api/v1/incubators/{chamber_a['id']}/readings").status_code
            == 404
        )
        assert (
            client_b.patch(
                f"/api/v1/incubators/{chamber_a['id']}",
                json={"name": "Stolen chamber"},
                headers=headers_b,
            ).status_code
            == 404
        )
        assert client_b.get("/api/v1/cycles").json()["data"] == []

        turn = client_a.post(
            f"/api/v1/incubators/{chamber_a['id']}/commands/turn",
            json={},
            headers=headers_a,
        )
        assert turn.status_code == 200, turn.text
        command_id = turn.json()["data"]["command_id"]
        assert (
            client_a.get(
                f"/api/v1/incubators/{chamber_a['id']}/commands/{command_id}"
            ).status_code
            == 200
        )
        assert (
            client_b.get(
                f"/api/v1/incubators/{chamber_a['id']}/commands/{command_id}"
            ).status_code
            == 404
        )

        started = client_a.post(
            f"/api/v1/incubators/{chamber_a['id']}/cycles",
            json={"mode_id": chamber_a["mode_id"], "total_eggs": 24},
            headers=headers_a,
        )
        assert started.status_code == 200, started.text
        stopped = client_a.post(
            f"/api/v1/incubators/{chamber_a['id']}/cycles/current/stop",
            json={},
            headers=headers_a,
        )
        assert stopped.status_code == 200, stopped.text
        history_a = client_a.get("/api/v1/cycles?status=stopped_early").json()["data"]
        history_b = client_b.get("/api/v1/cycles?status=stopped_early").json()["data"]
        assert len(history_a) == 1
        assert history_b == []

        assert (
            client_a.post("/api/v1/auth/logout", json={}, headers=headers_a).status_code
            == 200
        )
        assert client_a.get("/api/v1/auth/session").json()["data"] == {
            "authenticated": False,
            "registration_enabled": True,
        }
        assert client_a.get("/api/v1/incubators").status_code == 401

        wrong_password = client_a.post(
            "/api/v1/auth/login",
            json={"email": identity_a["user"]["email"], "password": "wrong password"},
        )
        assert wrong_password.status_code == 401
        remembered = client_a.post(
            "/api/v1/auth/login",
            json={
                "email": identity_a["user"]["email"],
                "password": "correct horse battery staple",
                "remember_me": True,
            },
        )
        assert remembered.status_code == 200, remembered.text
        assert "max-age=2592000" in remembered.headers["set-cookie"].lower()

    async def expire_session() -> None:
        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            async with database.sessions.begin() as session:
                await session.execute(
                    update(auth_sessions)
                    .where(auth_sessions.c.session_hash == secret_hash(token_b))
                    .values(
                        created_at=datetime.now(UTC) - timedelta(minutes=2),
                        expires_at=datetime.now(UTC) - timedelta(minutes=1),
                    )
                )
        finally:
            await database.close()

    asyncio.run(expire_session())
    app_expired = create_app(auth_settings)
    with TestClient(app_expired, base_url="https://testserver") as expired_client:
        expired_client.cookies.set("egg_session", token_b, path="/api/v1")
        assert expired_client.get("/api/v1/auth/session").json()["data"] == {
            "authenticated": False,
            "registration_enabled": True,
        }
        assert expired_client.get("/api/v1/incubators").status_code == 401


def test_login_is_rate_limited_and_success_clears_the_email_bucket(settings):
    auth_settings = Settings(
        app_env="test",
        auth_mode="sessions",
        storage_backend="postgres_incubators",
        database_url=settings.database_url,
        default_farm_id=str(uuid4()),
        cors_origins=("http://testserver",),
    )
    with TestClient(create_app(auth_settings)) as client:
        identity = _register(client, f"limit-{uuid4().hex[:8]}")
        email = identity["user"]["email"]
        for _ in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "incorrect password"},
            )
            assert response.status_code == 401
        limited = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "incorrect password"},
        )
        assert limited.status_code == 429
        assert limited.headers["retry-after"] == "900"
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "correct horse battery staple"},
            ).status_code
            == 429
        )


def test_production_closes_registration_and_operator_accounts_get_secure_sessions(
    settings,
):
    production_settings = Settings(
        app_env="production",
        auth_mode="sessions",
        storage_backend="postgres_incubators",
        database_url=settings.database_url,
        default_farm_id=str(uuid4()),
        cors_origins=("https://testserver",),
        public_registration_enabled=False,
        auth_rate_limit_key="test-auth-rate-limit-key-32-chars",
    )
    email = f"operator-{uuid4().hex[:8]}@example.test"
    password = "correct horse battery staple"

    async def provision_owner() -> None:
        from argparse import Namespace

        from eggcelerate_api.admin import _create_owner

        database = PostgresStore(settings.database_url, settings.default_farm_id)
        try:
            await _create_owner(
                database,
                Namespace(email=email, name="Operator Owner", farm="Preview Farm"),
                password,
            )
        finally:
            await database.close()

    asyncio.run(provision_owner())
    with TestClient(
        create_app(production_settings), base_url="https://testserver"
    ) as client:
        session = client.get("/api/v1/auth/session").json()["data"]
        assert session == {"authenticated": False, "registration_enabled": False}
        closed = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"closed-{uuid4().hex[:8]}@example.test",
                "password": password,
                "display_name": "New Owner",
                "farm_name": "New Farm",
            },
        )
        assert closed.status_code == 409
        assert closed.json()["error"]["code"] == "rejected"
        login = client.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        )
        assert login.status_code == 200
        assert "secure" in login.headers["set-cookie"].lower()
        old_session = client.get("/api/v1/auth/session").json()["data"]
        assert old_session["authenticated"] is True

        async def reset_password() -> None:
            from eggcelerate_api.admin import _reset_password

            database = PostgresStore(settings.database_url, settings.default_farm_id)
            try:
                await _reset_password(
                    database,
                    email,
                    "another correct horse battery",
                    production_settings,
                )
            finally:
                await database.close()

        asyncio.run(reset_password())
        assert client.get("/api/v1/auth/session").json()["data"] == {
            "authenticated": False,
            "registration_enabled": False,
        }
        assert (
            client.post(
                "/api/v1/auth/login", json={"email": email, "password": password}
            ).status_code
            == 401
        )
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": "another correct horse battery"},
            ).status_code
            == 200
        )

"""Measure /readyz startup for session-auth mode against disposable PostgreSQL.

Requires TEST_DATABASE_URL targeting loopback eggcelerate_test on port 55432, with
migrations already applied.
This starts and stops only an API subprocess owned by this invocation.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[3]


def main() -> None:
    database_url = os.environ.get("TEST_DATABASE_URL", "")
    source = make_url(database_url) if database_url else None
    if (
        source is None
        or source.database != "eggcelerate_test"
        or source.host not in {"localhost", "127.0.0.1", "::1"}
        or source.port != 55432
    ):
        raise ValueError(
            "TEST_DATABASE_URL must target loopback eggcelerate_test on port 55432."
        )
    env = {
        **os.environ,
        "APP_ENV": "development",
        "AUTH_MODE": "sessions",
        "PUBLIC_REGISTRATION_ENABLED": "false",
        "AUTH_RATE_LIMIT_KEY": "local-phase9-startup-measurement-key-32-chars",
        "DATABASE_URL": database_url,
        "DEFAULT_FARM_ID": str(uuid4()),
        "STORAGE_BACKEND": "postgres_incubators",
        "PYTHONPATH": str(ROOT / "apps/api/src"),
    }
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    address = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryFile(mode="w+") as log:
        started = time.perf_counter()
        server = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "eggcelerate_api.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=ROOT,
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(100):
                if server.poll() is not None:
                    raise RuntimeError("Session-mode API exited before readiness.")
                try:
                    with urllib.request.urlopen(
                        address + "/readyz", timeout=1
                    ) as response:
                        if response.status == 200:
                            elapsed_ms = (time.perf_counter() - started) * 1000
                            print(
                                "PASS: session-mode API /readyz startup in "
                                f"{elapsed_ms:.0f} ms against disposable PostgreSQL."
                            )
                            return
                except OSError, urllib.error.URLError:
                    time.sleep(0.1)
            log.seek(0)
            raise RuntimeError(
                "Session-mode API did not become ready.\n" + log.read()[-4000:]
            )
        finally:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()


if __name__ == "__main__":
    main()

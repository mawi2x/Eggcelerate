"""Run shared frontend contracts against an isolated disposable PostgreSQL farm.

From repository root:
TEST_DATABASE_URL=... apps/api/.venv/bin/python apps/api/scripts/verify_live_contract.py
The URL must target eggcelerate_test. No existing farm is mutated.
"""

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


def main():
    url = os.environ.get("TEST_DATABASE_URL", "")
    if not url or make_url(url).database != "eggcelerate_test":
        raise ValueError("TEST_DATABASE_URL must target disposable eggcelerate_test.")
    env = {
        **os.environ,
        "APP_ENV": "test",
        "DATABASE_URL": url,
        "DEFAULT_FARM_ID": str(uuid4()),
        "STORAGE_BACKEND": "postgres_incubators",
        "PYTHONPATH": str(ROOT / "apps/api/src"),
    }
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=ROOT / "apps/api",
        env=env,
        check=True,
    )
    subprocess.run(
        [sys.executable, "-m", "eggcelerate_api.database.seed"], env=env, check=True
    )
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    address = f"http://127.0.0.1:{port}"
    with tempfile.TemporaryFile(mode="w+") as log:
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
            env=env,
            stdout=log,
            stderr=log,
        )
        try:
            for _ in range(100):
                if server.poll() is not None:
                    raise RuntimeError("Isolated API exited before readiness.")
                try:
                    with urllib.request.urlopen(
                        address + "/readyz", timeout=1
                    ) as response:
                        if response.status == 200:
                            break
                except OSError, urllib.error.URLError:
                    time.sleep(0.1)
            else:
                raise RuntimeError("Isolated API did not become ready.")
            subprocess.run(
                [
                    "pnpm",
                    "--dir",
                    "apps/web",
                    "exec",
                    "vitest",
                    "run",
                    "src/tests/repository-contract.test.ts",
                ],
                cwd=ROOT,
                env={**env, "EGG_API_URL": address},
                check=True,
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

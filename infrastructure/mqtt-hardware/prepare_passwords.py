#!/usr/bin/env python3
"""Install pilot MQTT credentials and ACL without echoing secrets.

Usage: python3 infrastructure/mqtt-hardware/prepare_passwords.py --env-file .env.hardware
Prepare TLS files and private/device-password first. This preserves other broker users.
"""

import argparse
import os
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    private = root / "infrastructure/mqtt-hardware/private"
    settings = dict(
        line.split("=", 1)
        for line in args.env_file.read_text().splitlines()
        if line and not line.startswith("#") and "=" in line
    )
    worker = settings.get("MQTT_WORKER_PASSWORD", "")
    device = (private / "device-password").read_text().strip()
    if not worker or not device or any(c in worker + device for c in "\r\n"):
        raise SystemExit("Broker passwords must be nonempty single-line values.")
    script = f"""
set -eu
read -r worker
read -r device
if [ -f /private/passwords ]; then
  mosquitto_passwd -b /private/passwords eggcelerate-worker "$worker"
else
  mosquitto_passwd -b -c /private/passwords eggcelerate-worker "$worker"
fi
mosquitto_passwd -b /private/passwords EGG-001 "$device"
cp /template /private/acl
chown 1883:1883 /private/passwords /private/acl
chmod 600 /private/passwords /private/acl
chown {os.getuid()}:1883 /private /private/server.key
chmod 750 /private
chmod 640 /private/server.key
"""
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-i",
            "--user",
            "0",
            "--entrypoint",
            "sh",
            "-v",
            f"{private}:/private",
            "-v",
            f"{root / 'infrastructure/mqtt-hardware/acl'}:/template:ro",
            "eclipse-mosquitto:2",
            "-c",
            script,
        ],
        input=worker + "\n" + device + "\n",
        text=True,
        check=True,
    )
    print("Pilot MQTT credentials and ACL installed; secret values were not printed.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Prepare this laptop's existing TLS recorder for an ESP32 on the same LAN.

Does not flash hardware or change the VPS. Private outputs stay Git-ignored.
"""
import argparse
import ipaddress
import json
import os
from pathlib import Path
import secrets
import subprocess

root = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument("--host", required=True, help="Laptop LAN IPv4 address")
args = parser.parse_args()
host = str(ipaddress.IPv4Address(args.host))
if ipaddress.ip_address(host).is_unspecified or ipaddress.ip_address(host).is_loopback:
    parser.error("Use the laptop's LAN address, not a loopback/unspecified address")
os.umask(0o077)
private = root / "infrastructure/mqtt-hardware/private"
for name in ["server.key", "server.csr", "device-password"]:
    if not (private / name).is_file():
        raise SystemExit(f"Missing existing recorder material: {name}")
def openssl(*arguments):
    return subprocess.run(["openssl", *map(str, arguments)], check=True, capture_output=True)
local_key = private / "local-ca.key"
local_ca = private / "local-ca.crt"
if not local_key.exists():
    openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", local_key)
if not local_ca.exists():
    openssl("req", "-x509", "-new", "-key", local_key, "-days", "365", "-sha256",
            "-subj", "/CN=Eggcelerate Local Recorder CA",
            "-addext", "basicConstraints=critical,CA:TRUE",
            "-addext", "keyUsage=critical,keyCertSign,cRLSign",
            "-addext", "subjectKeyIdentifier=hash", "-out", local_ca)
os.chmod(local_key, 0o600)
os.chmod(local_ca, 0o644)
ext = private / "server-lan.ext"
ext.write_text(f"subjectAltName=IP:{host},IP:127.0.0.1,DNS:hardware-broker,DNS:localhost\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n")
local_cert = private / "local-server.crt"
openssl("x509", "-req", "-in", private / "server.csr", "-CA", local_ca, "-CAkey", local_key,
        "-set_serial", "0x" + secrets.token_hex(16), "-days", "300", "-sha256",
        "-extfile", ext, "-out", local_cert)
os.chmod(local_cert, 0o644)
openssl("verify", "-x509_strict", "-CAfile", local_ca, "-verify_ip", host, local_cert)
# Restore the original certificate if an earlier preparation added the LAN SAN.
backup = private / "server.crt.before-lan"
if backup.exists():
    (private / "server.crt").write_bytes(backup.read_bytes())
password = (private / "device-password").read_text().strip()
ca = local_ca.read_text()
config = root / "apps/firmware/Eggcelerate/LocalCloudConfig.h"
config.write_text(f'''#pragma once
#include <stdint.h>
// Private LOCAL recorder override; original VPS CloudConfig.h is preserved.
namespace EggCloudConfig {{
static constexpr char MQTT_HOST[] = {json.dumps(host)};
static constexpr uint16_t MQTT_PORT = 18883;
static constexpr char MQTT_USERNAME[] = "EGG-001";
static constexpr char MQTT_PASSWORD[] = {json.dumps(password)};
static constexpr char MQTT_ROOT_CA[] = R"EGGCA({ca})EGGCA";
}}
''')
os.chmod(config, 0o600)
env = root / ".env.hardware-local"
lines = [line for line in env.read_text().splitlines() if not line.startswith("LOCAL_MQTT_BIND_ADDRESS=")]
env.write_text("\n".join(lines) + f"\nLOCAL_MQTT_BIND_ADDRESS={host}\n")
os.chmod(env, 0o600)
print(f"Prepared local TLS recorder {host}:18883 and private LocalCloudConfig.h. Restart broker/worker, then compile. No hardware flashed.")

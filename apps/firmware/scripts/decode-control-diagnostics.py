#!/usr/bin/env python3
"""Decode saved diagnostic .bin files or a Serial text capture into JSON lines.

No connection to the ESP32 is opened. Files are read locally only.
"""

import argparse
import json
import math
import struct
import sys
import zlib
from datetime import UTC, datetime
from pathlib import Path

LAYOUT = struct.Struct("<IHHQQQqIIIIffffIIIIHBBBBBB12sI")
MAGIC = 0x45474431
FLAG_NAMES = (
    "sensor_valid", "running", "heater", "mist", "upper", "exhaust",
    "heat_demand", "dry_demand", "mist_demand", "temperature_cooling", "vent_on",
    "pwm_ready", "halted", "cooldown", "resuming", "trend_valid",
)
FIELDS = (
    "magic", "version", "size", "session", "monotonic_ms", "sample_monotonic_ms",
    "utc_ms", "sequence", "sample", "control_seq", "sample_age_ms",
    "temperature_c", "humidity_pct", "temperature_rate_c_min", "humidity_rate_pct_min",
    "heater_elapsed_ms", "mist_elapsed_ms", "vent_elapsed_ms", "dropped", "flags",
    "mode", "phase", "fault", "requested_duty", "applied_duty", "cause", "reason", "crc",
)

LAYOUT_V2 = struct.Struct(LAYOUT.format[:-1] + "IIIIIIIIffBBBBI")
FIELDS_V2 = FIELDS[:-1] + (
    "last_good_age_ms", "successes", "failures", "consecutive_failures", "recoveries",
    "last_failure_ms", "last_recovery_ms", "fault_at_ms", "last_good_temperature_c", "last_good_humidity_pct",
    "recovery_hold", "consecutive_good", "reset_reason", "reserved", "crc",
)
LAYOUT_V3 = struct.Struct(LAYOUT_V2.format[:-1] + "16f7I8BI")
ADAPTIVE_FIELDS = (
    "equivalent_rh", "moisture_rate_pct_min", "humidity_forecast", "heat_forecast_c", "cooling_forecast_c", "power_forecast_c",
    "thermal_target_c", "heating_power", "heat_integral", "heat_feed_forward", "dry_effort", "dry_baseline", "review_delta", "duty_seconds", "last_review_baseline", "last_review_duty_seconds", "last_review_eligible_ms", "last_review_exhaust_ms",
    "stable_ms", "review_elapsed_ms", "eligible_ms", "exhaust_ms", "review_count",
    "dry_held", "may_dry", "dry_limited", "thermal_ceiling", "review_result", "boost_active", "heat_window_second", "test_duty",
)
FIELDS_V3 = FIELDS_V2[:-1] + ADAPTIVE_FIELDS + ("crc",)
LAYOUTS = {1: (LAYOUT, FIELDS), 2: (LAYOUT_V2, FIELDS_V2), 3: (LAYOUT_V3, FIELDS_V3)}


def chunks(path: Path):
    if path.suffix.lower() == ".bin":
        data = path.read_bytes()
        offset = 0
        while offset < len(data):
            length = LAYOUT.size
            if len(data) - offset >= 8:
                magic, version, size = struct.unpack_from("<IHH", data, offset)
                if magic == MAGIC and version in LAYOUTS and size == LAYOUTS[version][0].size:
                    length = size
            yield f"{path}:{offset}", data[offset:offset + length]
            offset += length
        return
    for line_no, line in enumerate(path.read_text(errors="replace").splitlines(), 1):
        if not line.startswith("DIAG "):
            continue
        value = line[5:].strip()
        if value == "END":
            continue
        try:
            yield f"{path}:{line_no}", bytes.fromhex(value)
        except ValueError:
            yield f"{path}:{line_no}", b""


def timestamp(milliseconds):
    return datetime.fromtimestamp(milliseconds / 1000, UTC).isoformat(timespec="milliseconds")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", type=Path, nargs="+", help="Previous then current .bin, or saved Serial text")
    args = parser.parse_args()
    records, anchors, seen = [], {}, set()
    errors = 0
    for path in args.files:
        for source, raw in chunks(path):
            version = struct.unpack_from("<H", raw, 4)[0] if len(raw) >= 8 else 0
            layout, fields = LAYOUTS.get(version, (LAYOUT, FIELDS))
            if len(raw) != layout.size:
                print(f"{source}: incomplete/invalid diagnostic record", file=sys.stderr)
                errors += 1
                continue
            row = dict(zip(fields, layout.unpack(raw), strict=True))
            if (row["magic"] != MAGIC or row["version"] not in LAYOUTS or row["size"] != layout.size
                    or row["crc"] != zlib.crc32(raw[:-4])):
                print(f"{source}: unsupported header or CRC mismatch", file=sys.stderr)
                errors += 1
                continue
            key = (row["session"], row["sequence"])
            if key in seen:
                continue
            seen.add(key)
            row["source"] = source
            if row["utc_ms"]:
                anchors.setdefault(row["session"], row["utc_ms"] - row["monotonic_ms"])
            records.append(row)
    last_sequences = {}
    for row in records:
        session = row["session"]
        previous = last_sequences.get(session)
        row["sequence_gap"] = max(0, row["sequence"] - previous - 1) if previous is not None else None
        last_sequences[session] = row["sequence"]
        anchor = anchors.get(session)
        row["utc_inferred"] = not bool(row["utc_ms"]) and anchor is not None
        row["event_utc"] = timestamp(row["utc_ms"] or anchor + row["monotonic_ms"]) if row["utc_ms"] or anchor is not None else None
        row["sample_utc"] = timestamp(anchor + row["sample_monotonic_ms"]) if anchor is not None and row["sample"] else None
        row["session"] = f"{session:016x}"
        row["reason"] = row["reason"].split(b"\0", 1)[0].decode("ascii", errors="replace")
        row["states"] = {name: bool(row["flags"] & (1 << bit)) for bit, name in enumerate(FLAG_NAMES)}
        row["mode_name"] = {0: "Chicken", 1: "Duck", 2: "Quail"}.get(row["mode"], "unknown")
        if row["version"] >= 2:
            row["recovery_hold"] = bool(row["recovery_hold"])
            row["last_good_utc"] = timestamp(anchor + row["monotonic_ms"] - row["last_good_age_ms"]) if anchor is not None and row["successes"] else None
            for field in ("last_failure_ms", "last_recovery_ms", "fault_at_ms"):
                # Event counters distinguish absent events; fault_at_ms=0 is
                # unknown (including restored pre-boot fault origin).
                present = row["failures"] if field == "last_failure_ms" else row["recoveries"] if field == "last_recovery_ms" else row[field] != 0
                age = ((row["monotonic_ms"] & 0xffffffff) - row[field]) & 0xffffffff
                row[field.replace("_ms", "_utc")] = timestamp(anchor + row["monotonic_ms"] - age) if anchor is not None and present else None
            if not row["successes"]:
                row["last_good_age_ms"] = None
        if row["version"] >= 3:
            for field in ("dry_held", "may_dry", "dry_limited", "boost_active"):
                row[field] = bool(row[field])
        for name, value in list(row.items()):
            if isinstance(value, float) and not math.isfinite(value):
                row[name] = None
        print(json.dumps(row, allow_nan=False, separators=(",", ":")))
    print(f"Decoded {len(records)} unique records; {errors} invalid records.", file=sys.stderr)
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

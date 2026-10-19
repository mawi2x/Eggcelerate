import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

DECODER = Path(__file__).resolve().parents[1] / "scripts/decode-control-diagnostics.py"
spec = importlib.util.spec_from_file_location("decoder", DECODER)
decoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(decoder)


def record(seq=1, utc=0, version=1):
    layout, names = decoder.LAYOUTS[version]
    fields = dict.fromkeys(names, 0)
    fields.update(magic=decoder.MAGIC, version=version, size=layout.size,
                  session=42, sequence=seq, sample=seq, monotonic_ms=seq * 5000,
                  sample_monotonic_ms=seq * 5000 - 100, utc_ms=utc,
                  temperature_c=37.5, humidity_pct=58.0, reason=b"idle")
    if version >= 2:
        fields.update(last_good_age_ms=100, successes=2, failures=1, consecutive_failures=1,
                      recoveries=1, last_failure_ms=2500, last_recovery_ms=4000, fault_at_ms=4500,
                      last_good_temperature_c=37.5,last_good_humidity_pct=58.0,
                      recovery_hold=1,consecutive_good=0,reset_reason=3)
    raw = layout.pack(*(fields[k] for k in names))
    fields["crc"] = zlib.crc32(raw[:-4])
    return layout.pack(*(fields[k] for k in names))


class DecoderTests(unittest.TestCase):
    def decode(self, content, suffix=".bin"):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / ("capture" + suffix)
            path.write_bytes(content)
            result = subprocess.run([sys.executable, str(DECODER), str(path)], text=True,
                                    capture_output=True, check=False)
        return result, [json.loads(line) for line in result.stdout.splitlines()]

    def test_infers_only_same_boot_anchor_and_deduplicates(self):
        result, rows = self.decode(record() + record() + record(3, 1760000015000))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0]["utc_inferred"])
        self.assertEqual(rows[1]["sequence_gap"], 1)

    def test_unknown_clock_stays_unknown(self):
        result, rows = self.decode(record())
        self.assertEqual(result.returncode, 0)
        self.assertIsNone(rows[0]["event_utc"])

    def test_corruption_and_partial_tail_are_reported(self):
        damaged = bytearray(record(2))
        damaged[50] ^= 1
        result, rows = self.decode(record() + damaged + b"partial")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(len(rows), 1)
        self.assertIn("CRC mismatch", result.stderr)
        self.assertIn("incomplete", result.stderr)

    def test_serial_capture_ignores_other_output(self):
        text = "CONTROL ms=5000\nDIAG " + record().hex() + "\nDIAG END\n"
        result, rows = self.decode(text.encode(), ".txt")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(rows[0]["temperature_c"], 37.5)

    def test_mixed_versions_and_sensor_timestamps(self):
        result, rows = self.decode(record() + record(2,1760000010000,2))
        self.assertEqual(result.returncode,0)
        self.assertEqual([r["version"] for r in rows],[1,2])
        self.assertEqual(rows[1]["failures"],1)
        self.assertTrue(rows[1]["recovery_hold"])
        self.assertEqual(rows[1]["reset_reason"],3)
        self.assertIsNotNone(rows[1]["last_failure_utc"])
        self.assertIsNotNone(rows[1]["last_good_utc"])

    def test_v2_serial_and_partial_binary(self):
        result, rows=self.decode(("DIAG "+record(version=2).hex()+"\nDIAG END\n").encode(),".txt")
        self.assertEqual(result.returncode,0)
        self.assertEqual(rows[0]["size"],156)
        result, rows=self.decode(record(version=2)+record(seq=2,version=2)[:80])
        self.assertEqual(result.returncode,2)
        self.assertEqual(len(rows),1)

    def test_v2_crc_corruption(self):
        raw=bytearray(record(version=2));raw[120]^=1
        result,rows=self.decode(raw)
        self.assertEqual(result.returncode,2)
        self.assertFalse(rows)

    def test_v3_mixed_versions(self):
        result, rows = self.decode(record() + record(2,version=2) + record(3,version=3))
        self.assertEqual(result.returncode,0)
        self.assertEqual([r["size"] for r in rows],[112,156,256])
        self.assertEqual(rows[-1]["test_duty"],0)
        self.assertFalse(rows[-1]["dry_held"])


if __name__ == "__main__":
    unittest.main()

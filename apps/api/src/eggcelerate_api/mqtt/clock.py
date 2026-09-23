"""Shared clock-skew allowance for device-originated timestamps."""

from datetime import timedelta

DEVICE_CLOCK_TOLERANCE = timedelta(seconds=60)

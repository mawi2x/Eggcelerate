"""Supported Philippine pilot presets; old IDs remain usable for history."""

MODE_NAMES = {"broiler": "Chicken", "duck": "Duck", "quail": "Quail"}
MODE_IDS = frozenset(MODE_NAMES)
RETIRED_MODE_IDS = frozenset(
    {"goose", "turkey", "pheasant", "peafowl", "swan", "broiler-hh", "rapid-quail"}
)


def selectable_mode(mode_id: str, built_in: bool) -> bool:
    return mode_id in MODE_IDS or (not built_in and mode_id not in RETIRED_MODE_IDS)

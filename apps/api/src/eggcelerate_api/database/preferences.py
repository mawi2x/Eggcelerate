"""Map explicit preference columns and the extensible notification toggle map."""

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from ..models import PreferencesDTO


def preference_values(farm_id: UUID, preferences: PreferencesDTO) -> dict[str, Any]:
    values = preferences.model_dump(mode="json")
    notifications = values.pop("notifications")
    values.update(
        {f"notification_{key}": value for key, value in notifications.items()}
    )
    return {"farm_id": farm_id, **values}


def preferences_from_row(row: Mapping[str, Any]) -> PreferencesDTO:
    values = dict(row)
    values.pop("farm_id")
    values["notifications"] = {
        key.removeprefix("notification_"): values.pop(key)
        for key in list(values)
        if key.startswith("notification_")
    }
    return PreferencesDTO.model_validate(values)

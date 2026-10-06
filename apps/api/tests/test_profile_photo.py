"""Profile photos are optional, bounded JPEG data URLs in preferences."""

import pytest
from pydantic import ValidationError

from eggcelerate_api.models import PreferencesDTO
from eggcelerate_api.store import MemoryStore


def test_profile_photo_accepts_photo_and_removal():
    values = MemoryStore().preferences.model_dump()
    for photo in ("data:image/jpeg;base64,/9j/AA==", None):
        assert (
            PreferencesDTO.model_validate(
                {**values, "profile_photo": photo}
            ).profile_photo
            == photo
        )


@pytest.mark.parametrize(
    "photo",
    [
        "https://example.com/photo.jpg",
        "data:image/svg+xml;base64,AA==",
        "data:image/jpeg;base64," + "A" * 180_000,
    ],
)
def test_profile_photo_rejects_invalid_or_oversized_data(photo):
    values = MemoryStore().preferences.model_dump()
    with pytest.raises(ValidationError):
        PreferencesDTO.model_validate({**values, "profile_photo": photo})


def test_profile_photo_saves_and_can_be_removed():
    from .conftest import make_client

    with make_client() as client:
        original = client.get("/api/v1/preferences").json()["data"]
        changed = {**original, "profile_photo": "data:image/jpeg;base64,/9j/AA=="}
        assert client.put("/api/v1/preferences", json=changed).status_code == 200
        assert client.get("/api/v1/preferences").json()["data"] == changed
        removed = {**changed, "profile_photo": None}
        assert client.put("/api/v1/preferences", json=removed).status_code == 200
        assert client.get("/api/v1/preferences").json()["data"]["profile_photo"] is None

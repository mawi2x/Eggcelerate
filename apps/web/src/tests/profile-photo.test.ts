import { describe, expect, it, vi } from "vitest";
import { initialSettings } from "../app/data/settings";
import {
  preferencesFromDTO,
  preferencesToDTO,
} from "../app/data/transport/contracts";
import {
  PROFILE_PHOTO_MAX_BYTES,
  prepareProfilePhoto,
  validateProfilePhoto,
} from "../app/features/account/profile-photo";

describe("profile photos", () => {
  it("center-crops to 256 pixels and releases the temporary image URL", async () => {
    const drawImage = vi.fn();
    const revoke = vi.fn();
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = 800;
        naturalHeight = 600;
        decode = async () => {};
      },
    );
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:photo",
      revokeObjectURL: revoke,
    });
    const context = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({
        fillRect: vi.fn(),
        drawImage,
      } as unknown as CanvasRenderingContext2D);
    const encode = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/jpeg;base64,/9j/AA==");
    try {
      await prepareProfilePhoto(
        new File(["photo"], "photo.png", { type: "image/png" }),
      );
      expect(drawImage).toHaveBeenCalledWith(
        expect.anything(),
        100,
        0,
        600,
        600,
        0,
        0,
        256,
        256,
      );
      expect(encode).toHaveBeenCalledWith("image/jpeg", 0.85);
      expect(revoke).toHaveBeenCalledWith("blob:photo");
    } finally {
      context.mockRestore();
      encode.mockRestore();
      vi.unstubAllGlobals();
    }
  });
  it("allows supported images at the limit and rejects oversized or unsupported files", () => {
    expect(
      validateProfilePhoto(
        new File([new Uint8Array(PROFILE_PHOTO_MAX_BYTES)], "photo.jpg", {
          type: "image/jpeg",
        }),
      ),
    ).toBeNull();
    expect(
      validateProfilePhoto(
        new File([new Uint8Array(PROFILE_PHOTO_MAX_BYTES + 1)], "photo.png", {
          type: "image/png",
        }),
      ),
    ).toContain("2 MB");
    expect(
      validateProfilePhoto(
        new File(["svg"], "photo.svg", { type: "image/svg+xml" }),
      ),
    ).toContain("JPG, PNG, or WebP");
  });

  it("preserves a saved photo and its removal across transport", () => {
    for (const profilePhoto of ["data:image/jpeg;base64,/9j/AA==", null]) {
      const settings = {
        ...initialSettings,
        account: { ...initialSettings.account, profilePhoto },
      };
      expect(preferencesFromDTO(preferencesToDTO(settings))).toEqual(settings);
    }
  });
});

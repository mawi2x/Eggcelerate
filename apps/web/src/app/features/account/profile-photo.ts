export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_PHOTO_MAX_DATA_LENGTH = 180_000;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateProfilePhoto(file: File): string | null {
  if (!supportedTypes.has(file.type))
    return "Choose a JPG, PNG, or WebP image.";
  if (file.size > PROFILE_PHOTO_MAX_BYTES)
    return "Profile photos must be 2 MB or smaller.";
  return null;
}

export async function prepareProfilePhoto(file: File): Promise<string> {
  const error = validateProfilePhoto(file);
  if (error) throw new Error(error);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the photo.");
    const edge = Math.min(image.naturalWidth, image.naturalHeight);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 256, 256);
    context.drawImage(
      image,
      (image.naturalWidth - edge) / 2,
      (image.naturalHeight - edge) / 2,
      edge,
      edge,
      0,
      0,
      256,
      256,
    );
    const photo = canvas.toDataURL("image/jpeg", 0.85);
    if (photo.length > PROFILE_PHOTO_MAX_DATA_LENGTH)
      throw new Error(
        "This image could not be reduced enough. Choose another photo.",
      );
    return photo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Crops a picture to a square and shrinks it, so a profile photo is about 20 KB instead of several MB.
 * Returns a data URL that can be saved straight into the user's profile.
 */
export async function resizeToSquareDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', 0.82);
}

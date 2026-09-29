// Shrinks a photo of a book cover to a small JPEG kept with the book record. Photos are kept for
// books that have no online cover; the size limit keeps the library light.
export const MAX_PHOTO_CHARS = 140_000
export const isPhoto = (url: string | undefined) =>
  Boolean(url?.startsWith('data:image/jpeg;base64,'))
export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.')
  if (file.size > 30_000_000) throw new Error('That photo is too large.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    for (const [side, quality] of [
      [520, 0.78],
      [440, 0.7],
      [360, 0.62],
      [300, 0.55],
    ] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const url = canvas.toDataURL('image/jpeg', quality)
      if (url.length <= MAX_PHOTO_CHARS) return url
    }
    throw new Error('Could not make that photo small enough. Try a closer, simpler picture.')
  } finally {
    bitmap.close()
  }
}

import type { Size } from './types'

export async function measureRasterSize(blob: Blob): Promise<Size | undefined> {
  try {
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  }
  catch {
    return undefined
  }
}

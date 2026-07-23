export interface RasterSize {
  width: number
  height: number
}

export async function measureRasterSize(blob: Blob): Promise<RasterSize | undefined> {
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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureRasterSize } from './image-size'

describe('measureRasterSize', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功时返回位图宽高，并释放 bitmap', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 64, height: 48, close }))

    const size = await measureRasterSize(new Blob([], { type: 'image/png' }))

    expect(size).toEqual({ width: 64, height: 48 })
    expect(close).toHaveBeenCalledOnce()
  })

  it('createImageBitmap 抛错时返回 undefined，不抛异常', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))

    await expect(measureRasterSize(new Blob([], { type: 'image/png' }))).resolves.toBeUndefined()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyImageLoadable } from './verify-image-loadable'

interface ImageStub {
  src: string
  onload: (() => void) | null
  onerror: (() => void) | null
}

let currentStub: ImageStub

// 具名函数声明（非内联函数表达式），才能既满足 new Image() 的构造函数要求，又不被 prefer-arrow-callback 误判
function ImageConstructorMock(): ImageStub {
  return currentStub
}

function stubImage(): ImageStub {
  currentStub = { src: '', onload: null, onerror: null }
  vi.stubGlobal('Image', vi.fn(ImageConstructorMock))
  return currentStub
}

describe('verifyImageLoadable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('onload 触发时 resolve true', async () => {
    const image = stubImage()

    const result = verifyImageLoadable('https://example.com/a.png')
    image.onload?.()

    await expect(result).resolves.toBe(true)
  })

  it('onerror 触发时 resolve false', async () => {
    const image = stubImage()

    const result = verifyImageLoadable('https://example.com/broken.png')
    image.onerror?.()

    await expect(result).resolves.toBe(false)
  })

  it('超过 timeoutMs 未触发任何回调时 resolve false', async () => {
    stubImage()

    const result = verifyImageLoadable('https://example.com/slow.png', 1000)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(result).resolves.toBe(false)
  })

  it('超时后再触发 onload 不会二次 resolve（只结算一次）', async () => {
    const image = stubImage()

    const result = verifyImageLoadable('https://example.com/slow.png', 1000)
    await vi.advanceTimersByTimeAsync(1000)
    image.onload?.()

    await expect(result).resolves.toBe(false)
  })
})

import type { IconCandidate } from './types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeCandidate } from './candidate-probe'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

function bytesResponse(bytes: Uint8Array, contentType?: string, status = 200): Response {
  const headers = new Headers()
  if (contentType !== undefined)
    headers.set('content-type', contentType)
  // 复制成 ArrayBuffer 背衬的副本再包 Blob，避免 Uint8Array<ArrayBufferLike> 不满足 BodyInit/BlobPart 类型
  return new Response(new Blob([new Uint8Array(bytes)]), { status, headers })
}

function linkCandidate(overrides: Partial<IconCandidate> = {}): IconCandidate {
  return { url: 'https://example.com/icon.png', source: 'link', ...overrides }
}

describe('probeCandidate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('响应非 2xx 时返回 undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bytesResponse(new Uint8Array(), 'image/png', 404)))

    await expect(probeCandidate(linkCandidate())).resolves.toBeUndefined()
  })

  it('优先使用响应头 content-type，位图走 createImageBitmap 测量', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bytesResponse(PNG_BYTES, 'image/png')))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 16, height: 16, close: vi.fn() }))

    await expect(probeCandidate(linkCandidate())).resolves.toEqual({
      url: 'https://example.com/icon.png',
      source: 'link',
      mimeType: 'image/png',
      width: 16,
      height: 16,
    })
  })

  it('content-type 为 octet-stream 时回退到字节嗅探', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bytesResponse(PNG_BYTES, 'application/octet-stream')))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 32, height: 32, close: vi.fn() }))

    const result = await probeCandidate(linkCandidate())

    expect(result?.mimeType).toBe('image/png')
    expect(result?.width).toBe(32)
  })

  it('响应为 SVG 时走文本正则解析尺寸，不调用 createImageBitmap', async () => {
    const svg = new TextEncoder().encode('<svg width="24" height="24"></svg>')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bytesResponse(svg, 'image/svg+xml')))
    const bitmapSpy = vi.fn()
    vi.stubGlobal('createImageBitmap', bitmapSpy)

    const result = await probeCandidate(linkCandidate({ url: 'https://example.com/icon.svg' }))

    expect(result).toEqual({
      url: 'https://example.com/icon.svg',
      source: 'link',
      mimeType: 'image/svg+xml',
      width: 24,
      height: 24,
    })
    expect(bitmapSpy).not.toHaveBeenCalled()
  })

  it('content-type 带 charset 参数时能正确剥离', async () => {
    const svg = new TextEncoder().encode('<svg width="48" height="48"></svg>')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bytesResponse(svg, 'image/svg+xml; charset=utf-8')))

    const result = await probeCandidate(linkCandidate({ url: 'https://example.com/icon.svg' }))

    expect(result?.mimeType).toBe('image/svg+xml')
    expect(result?.width).toBe(48)
  })

  it('无法识别 MIME（octet-stream 且魔数未知）时返回 undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bytesResponse(new Uint8Array([0, 1, 2, 3]), 'application/octet-stream')))

    await expect(probeCandidate(linkCandidate())).resolves.toBeUndefined()
  })

  it('位图测量失败时回退到候选自带的尺寸', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(bytesResponse(PNG_BYTES, 'image/png')))
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))

    const result = await probeCandidate(linkCandidate({ width: 48, height: 48 }))

    expect(result).toEqual({
      url: 'https://example.com/icon.png',
      source: 'link',
      mimeType: 'image/png',
      width: 48,
      height: 48,
    })
  })

  it('fetch 抛错（含超时 abort）时返回 undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')))

    await expect(probeCandidate(linkCandidate())).resolves.toBeUndefined()
  })
})

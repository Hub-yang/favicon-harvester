import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout } from './fetch-with-timeout'
import { fetchIconBytes } from './icon-bytes'

vi.mock('./fetch-with-timeout', () => ({ fetchWithTimeout: vi.fn() }))

function makeResponse(bytes: Uint8Array, contentType?: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType ?? null : null) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01, 0x02])

describe('fetchIconBytes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('取回字节并按 base64 回传，MIME 优先取响应头', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(makeResponse(PNG_BYTES, 'image/png'))

    const result = await fetchIconBytes('https://example.com/a.png')

    expect(result).toEqual({ success: true, base64: btoa(String.fromCharCode(...PNG_BYTES)), mimeType: 'image/png' })
  })

  it('响应头是 octet-stream 时改用字节嗅探，避免把 PNG 当成二进制流', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(makeResponse(PNG_BYTES, 'application/octet-stream'))

    const result = await fetchIconBytes('https://example.com/a')

    expect(result.mimeType).toBe('image/png')
  })

  it('响应状态非 2xx 时返回失败结果而不是抛错', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(makeResponse(new Uint8Array(), undefined, false, 404))

    const result = await fetchIconBytes('https://example.com/missing.png')

    expect(result.success).toBe(false)
    expect(result.error).toContain('404')
  })

  it('网络异常（含超时 abort）被兜住，返回失败结果', async () => {
    vi.mocked(fetchWithTimeout).mockRejectedValue(new Error('aborted'))

    const result = await fetchIconBytes('https://example.com/slow.png')

    expect(result.success).toBe(false)
    expect(result.error).toContain('aborted')
  })

  it('既没有响应头也嗅探不出 MIME 时按失败处理，避免下游拿到空类型', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValue(makeResponse(new Uint8Array([0x00, 0x01, 0x02]), undefined))

    const result = await fetchIconBytes('https://example.com/weird')

    expect(result.success).toBe(false)
  })
})

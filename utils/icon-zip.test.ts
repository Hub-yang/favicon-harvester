import type { IconCandidate } from './types'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchIconBytes } from './icon-bytes'
import { buildIconZipDataUrl } from './icon-zip'

vi.mock('./icon-bytes', () => ({ fetchIconBytes: vi.fn() }))

const PNG_A = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x11])
const PNG_B = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x22])

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function okBytes(bytes: Uint8Array, mimeType = 'image/png') {
  return { success: true as const, base64: toBase64(bytes), mimeType }
}

/** 把 buildIconZipDataUrl 返回的 data URL 还原成解开后的 zip 条目表 */
function unzipDataUrl(dataUrl: string): Record<string, Uint8Array> {
  const base64 = dataUrl.replace(/^data:application\/zip;base64,/, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1)
    bytes[i] = binary.charCodeAt(i)

  return unzipSync(bytes)
}

const CANDIDATE_A: IconCandidate = {
  url: 'https://example.com/a.png',
  source: 'link',
  sourceDetail: 'icon',
  width: 32,
  height: 32,
  mimeType: 'image/png',
}
const CANDIDATE_B: IconCandidate = {
  url: 'https://example.com/b.png',
  source: 'manifest',
  width: 192,
  height: 192,
  mimeType: 'image/png',
}

describe('buildIconZipDataUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-08T01:02:03.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('把每个图标的原始字节按 buildIconBasename 命名放进 zip', async () => {
    vi.mocked(fetchIconBytes)
      .mockResolvedValueOnce(okBytes(PNG_A))
      .mockResolvedValueOnce(okBytes(PNG_B))

    const result = await buildIconZipDataUrl([CANDIDATE_A, CANDIDATE_B], 'example.com')

    expect(result.success).toBe(true)
    const entries = unzipDataUrl(result.dataUrl!)
    expect(entries['example.com-link-32x32.png']).toEqual(PNG_A)
    expect(entries['example.com-manifest-192x192.png']).toEqual(PNG_B)
  })

  it('附带 icons.json 记录每个图标的来源、尺寸与 MIME', async () => {
    vi.mocked(fetchIconBytes).mockResolvedValue(okBytes(PNG_A))

    const result = await buildIconZipDataUrl([CANDIDATE_A], 'example.com')
    const manifest = JSON.parse(new TextDecoder().decode(unzipDataUrl(result.dataUrl!)['icons.json']))

    expect(manifest).toEqual({
      site: 'example.com',
      generatedAt: '2026-09-08T01:02:03.000Z',
      icons: [{
        file: 'example.com-link-32x32.png',
        url: 'https://example.com/a.png',
        source: 'link',
        sourceDetail: 'icon',
        width: 32,
        height: 32,
        mimeType: 'image/png',
      }],
    })
  })

  it('并行取字节而不是逐个串行，与扫描阶段的 Promise.all 行为一致', async () => {
    let inFlight = 0
    let peak = 0
    vi.mocked(fetchIconBytes).mockImplementation(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight -= 1
      return okBytes(PNG_A)
    })

    await buildIconZipDataUrl([CANDIDATE_A, CANDIDATE_B], 'example.com')

    expect(peak).toBe(2)
  })

  it('取字节失败的图标被跳过，其余照常打包并计入 skipped', async () => {
    vi.mocked(fetchIconBytes)
      .mockResolvedValueOnce({ success: false, error: 'HTTP 404' })
      .mockResolvedValueOnce(okBytes(PNG_B))

    const result = await buildIconZipDataUrl([CANDIDATE_A, CANDIDATE_B], 'example.com')

    expect(result).toMatchObject({ success: true, packed: 1, skipped: 1 })
    const entries = unzipDataUrl(result.dataUrl!)
    expect(Object.keys(entries).sort()).toEqual(['example.com-manifest-192x192.png', 'icons.json'])
  })

  it('全部取字节失败时返回失败结果，不产出空 zip', async () => {
    vi.mocked(fetchIconBytes).mockResolvedValue({ success: false, error: 'HTTP 404' })

    const result = await buildIconZipDataUrl([CANDIDATE_A, CANDIDATE_B], 'example.com')

    expect(result.success).toBe(false)
    expect(result.dataUrl).toBeUndefined()
  })

  it('候选为空时直接返回失败，不发任何取字节请求', async () => {
    const result = await buildIconZipDataUrl([], 'example.com')

    expect(result.success).toBe(false)
    expect(fetchIconBytes).not.toHaveBeenCalled()
  })

  it('命名相同的两个图标在包内被消解成不同条目，不会互相覆盖', async () => {
    const twin: IconCandidate = { ...CANDIDATE_A, url: 'https://cdn.example.com/a.png' }
    vi.mocked(fetchIconBytes)
      .mockResolvedValueOnce(okBytes(PNG_A))
      .mockResolvedValueOnce(okBytes(PNG_B))

    const result = await buildIconZipDataUrl([CANDIDATE_A, twin], 'example.com')

    const entries = unzipDataUrl(result.dataUrl!)
    expect(entries['example.com-link-32x32.png']).toEqual(PNG_A)
    expect(entries['example.com-link-32x32-2.png']).toEqual(PNG_B)
  })

  it('fetchIconBytes 抛异常时计为跳过而不是让整包失败', async () => {
    vi.mocked(fetchIconBytes)
      .mockRejectedValueOnce(new Error('Extension context invalidated'))
      .mockResolvedValueOnce(okBytes(PNG_B))

    const result = await buildIconZipDataUrl([CANDIDATE_A, CANDIDATE_B], 'example.com')

    expect(result).toMatchObject({ success: true, packed: 1, skipped: 1 })
  })
})

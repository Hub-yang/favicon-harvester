import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchManifestCandidates } from './manifest-candidates'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('fetchManifestCandidates', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('合法 JSON 时按 manifest 自身 URL 解析相对路径，并解析 sizes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512 256x256' },
      ],
    })))

    const candidates = await fetchManifestCandidates('https://example.com/app/site.webmanifest')

    expect(candidates).toEqual([
      {
        url: 'https://example.com/app/icons/icon-192.png',
        source: 'manifest',
        sourceDetail: 'any',
        width: 192,
        height: 192,
      },
      {
        url: 'https://example.com/icons/icon-512.png',
        source: 'manifest',
        sourceDetail: undefined,
        width: 512,
        height: 512,
      },
    ])
  })

  it('非法 JSON 时返回空数组，不抛异常', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))

    await expect(fetchManifestCandidates('https://example.com/site.webmanifest')).resolves.toEqual([])
  })

  it('404 时返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))

    await expect(fetchManifestCandidates('https://example.com/site.webmanifest')).resolves.toEqual([])
  })

  it('fetch 本身抛错时返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    await expect(fetchManifestCandidates('https://example.com/site.webmanifest')).resolves.toEqual([])
  })

  it('icons 字段缺失时返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))

    await expect(fetchManifestCandidates('https://example.com/site.webmanifest')).resolves.toEqual([])
  })
})

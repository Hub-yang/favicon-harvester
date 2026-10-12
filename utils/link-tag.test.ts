import type { IconCandidate } from './types'
import { describe, expect, it } from 'vitest'
import { buildLinkTag } from './link-tag'

describe('buildLinkTag', () => {
  it('来源是页面 link 标签时，直接复用页面上原始的 rel 值', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/apple-touch-icon.png',
      source: 'link',
      sourceDetail: 'apple-touch-icon',
      width: 180,
      height: 180,
      mimeType: 'image/png',
    }

    expect(buildLinkTag(candidate)).toBe(
      '<link rel="apple-touch-icon" type="image/png" sizes="180x180" href="https://example.com/apple-touch-icon.png">',
    )
  })

  it('well-known 路径按文件名识别出 apple-touch-icon', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/apple-touch-icon.png',
      source: 'well-known',
      sourceDetail: 'apple-touch-icon.png',
      mimeType: 'image/png',
    }

    expect(buildLinkTag(candidate)).toContain('rel="apple-touch-icon"')
  })

  it('manifest 与 tab 来源统一回退到 rel="icon"', () => {
    const manifest: IconCandidate = { url: 'https://example.com/a.png', source: 'manifest', sourceDetail: 'any' }
    const tab: IconCandidate = { url: 'https://example.com/f.ico', source: 'tab' }

    expect(buildLinkTag(manifest)).toContain('rel="icon"')
    expect(buildLinkTag(tab)).toContain('rel="icon"')
  })

  it('缺 mimeType 时不输出 type 属性', () => {
    const candidate: IconCandidate = { url: 'https://example.com/f.ico', source: 'tab', width: 16, height: 16 }

    expect(buildLinkTag(candidate)).toBe('<link rel="icon" sizes="16x16" href="https://example.com/f.ico">')
  })

  it('多帧 ICO 的 sizes 写全每一帧，而不是只写实测的最大帧', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'well-known',
      sourceDetail: 'favicon.ico',
      width: 48,
      height: 48,
      mimeType: 'image/x-icon',
      frameSizes: [{ width: 16, height: 16 }, { width: 32, height: 32 }, { width: 48, height: 48 }],
    }

    expect(buildLinkTag(candidate)).toBe(
      '<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="https://example.com/favicon.ico">',
    )
  })

  it('多帧 ICO 含非正方形帧时，每项都写宽x高', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'tab',
      width: 32,
      height: 32,
      frameSizes: [{ width: 16, height: 24 }, { width: 32, height: 32 }],
    }

    expect(buildLinkTag(candidate)).toContain('sizes="16x24 32x32"')
  })

  it('缺尺寸时不输出 sizes 属性', () => {
    const candidate: IconCandidate = { url: 'https://example.com/a.svg', source: 'link', sourceDetail: 'icon', mimeType: 'image/svg+xml' }

    expect(buildLinkTag(candidate)).toBe('<link rel="icon" type="image/svg+xml" href="https://example.com/a.svg">')
  })

  it('转义 href 里的双引号，避免拼出的标签被截断', () => {
    const candidate: IconCandidate = { url: 'https://example.com/a.png?q="x"', source: 'tab' }

    expect(buildLinkTag(candidate)).toBe('<link rel="icon" href="https://example.com/a.png?q=&quot;x&quot;">')
  })
})

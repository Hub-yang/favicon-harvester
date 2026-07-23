import type { IconCandidate } from './types'
import { describe, expect, it } from 'vitest'
import { buildFilename } from './icon-naming'

describe('buildFilename', () => {
  it('有尺寸时按 domain-source-WxH.ext 命名', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/apple-touch-icon.png',
      source: 'link',
      width: 180,
      height: 180,
      mimeType: 'image/png',
    }

    expect(buildFilename('example.com', candidate)).toBe('example.com-link-180x180.png')
  })

  it('无尺寸且来源是 well-known 时直接复用 sourceDetail，不重复拼接扩展名', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'well-known',
      sourceDetail: 'favicon.ico',
    }

    expect(buildFilename('example.com', candidate)).toBe('example.com-favicon.ico')
  })

  it('相近的 well-known 文件名不会互相冲突', () => {
    const precomposed: IconCandidate = {
      url: 'https://example.com/apple-touch-icon-precomposed.png',
      source: 'well-known',
      sourceDetail: 'apple-touch-icon-precomposed.png',
    }
    const plain: IconCandidate = {
      url: 'https://example.com/apple-touch-icon.png',
      source: 'well-known',
      sourceDetail: 'apple-touch-icon.png',
    }

    expect(buildFilename('example.com', precomposed)).toBe('example.com-apple-touch-icon-precomposed.png')
    expect(buildFilename('example.com', plain)).toBe('example.com-apple-touch-icon.png')
  })

  it('无尺寸且来源是 manifest/tab 等其他分支时按 domain-source.ext 命名', () => {
    const manifestCandidate: IconCandidate = {
      url: 'https://example.com/icons/icon.png',
      source: 'manifest',
      mimeType: 'image/png',
    }
    const tabCandidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'tab',
    }

    expect(buildFilename('example.com', manifestCandidate)).toBe('example.com-manifest.png')
    expect(buildFilename('example.com', tabCandidate)).toBe('example.com-tab.ico')
  })

  it('mimeType 缺失且 URL 无已知扩展名时兜底为 png', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon?format=raw',
      source: 'tab',
    }

    expect(buildFilename('example.com', candidate)).toBe('example.com-tab.png')
  })
})

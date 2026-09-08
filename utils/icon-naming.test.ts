import type { IconCandidate } from './types'
import { describe, expect, it } from 'vitest'
import { buildFilename, buildIconBasename, buildZipFilename } from './icon-naming'

describe('buildFilename', () => {
  it('有尺寸时按 domain-source-WxH.ext 命名', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/apple-touch-icon.png',
      source: 'link',
      width: 180,
      height: 180,
      mimeType: 'image/png',
    }

    expect(buildFilename('example.com', candidate)).toBe('favicon-harvester/example.com/example.com-link-180x180.png')
  })

  it('无尺寸且来源是 well-known 时直接复用 sourceDetail，不重复拼接扩展名', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'well-known',
      sourceDetail: 'favicon.ico',
    }

    expect(buildFilename('example.com', candidate)).toBe('favicon-harvester/example.com/example.com-favicon.ico')
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

    expect(buildFilename('example.com', precomposed)).toBe('favicon-harvester/example.com/example.com-apple-touch-icon-precomposed.png')
    expect(buildFilename('example.com', plain)).toBe('favicon-harvester/example.com/example.com-apple-touch-icon.png')
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

    expect(buildFilename('example.com', manifestCandidate)).toBe('favicon-harvester/example.com/example.com-manifest.png')
    expect(buildFilename('example.com', tabCandidate)).toBe('favicon-harvester/example.com/example.com-tab.ico')
  })

  it('mimeType 缺失且 URL 无已知扩展名时兜底为 png', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon?format=raw',
      source: 'tab',
    }

    expect(buildFilename('example.com', candidate)).toBe('favicon-harvester/example.com/example.com-tab.png')
  })

  it('统一落在 favicon-harvester/<域名>/ 子目录下，不污染下载根目录', () => {
    const candidate: IconCandidate = {
      url: 'https://sub.example.com/favicon.ico',
      source: 'tab',
    }

    expect(buildFilename('sub.example.com', candidate)).toBe('favicon-harvester/sub.example.com/sub.example.com-tab.ico')
  })

  it('域名缺失时退化到 favicon-harvester/ 根目录，不产生空目录层级', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'tab',
    }

    expect(buildFilename('', candidate)).toBe('favicon-harvester/tab.ico')
  })
})

describe('buildIconBasename', () => {
  it('返回不含目录的扁平文件名，供 zip 内条目直接使用', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/apple-touch-icon.png',
      source: 'link',
      width: 180,
      height: 180,
      mimeType: 'image/png',
    }

    expect(buildIconBasename('example.com', candidate)).toBe('example.com-link-180x180.png')
  })

  it('域名缺失时不带前导连字符', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'tab',
    }

    expect(buildIconBasename('', candidate)).toBe('tab.ico')
  })

  it('与 buildFilename 共用同一套命名规则，只差目录前缀', () => {
    const candidate: IconCandidate = {
      url: 'https://example.com/favicon.ico',
      source: 'well-known',
      sourceDetail: 'favicon.ico',
    }

    expect(buildFilename('example.com', candidate))
      .toBe(`favicon-harvester/example.com/${buildIconBasename('example.com', candidate)}`)
  })
})

describe('buildZipFilename', () => {
  it('打包文件与域名目录平级，不套进域名目录里', () => {
    expect(buildZipFilename('example.com')).toBe('favicon-harvester/example.com-icons.zip')
  })

  it('域名缺失时退化为不带前缀的包名', () => {
    expect(buildZipFilename('')).toBe('favicon-harvester/icons.zip')
  })
})

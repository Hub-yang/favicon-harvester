import { describe, expect, it } from 'vitest'
import { buildWellKnownCandidates } from './well-known-candidates'

describe('buildWellKnownCandidates', () => {
  it('基于 origin 生成 5 个固定 well-known 候选', () => {
    const result = buildWellKnownCandidates('https://example.com')

    expect(result).toEqual([
      { url: 'https://example.com/favicon.ico', source: 'well-known', sourceDetail: 'favicon.ico' },
      { url: 'https://example.com/favicon.png', source: 'well-known', sourceDetail: 'favicon.png' },
      { url: 'https://example.com/favicon.svg', source: 'well-known', sourceDetail: 'favicon.svg' },
      { url: 'https://example.com/apple-touch-icon.png', source: 'well-known', sourceDetail: 'apple-touch-icon.png' },
      { url: 'https://example.com/apple-touch-icon-precomposed.png', source: 'well-known', sourceDetail: 'apple-touch-icon-precomposed.png' },
    ])
  })

  it('sourceDetail 是去掉开头斜杠的文件名（供命名规则直接复用）', () => {
    const result = buildWellKnownCandidates('https://a.b')

    expect(result.every(c => !c.sourceDetail?.startsWith('/'))).toBe(true)
  })

  it('带端口的 origin 也正确拼接', () => {
    const result = buildWellKnownCandidates('http://localhost:3000')

    expect(result[0]?.url).toBe('http://localhost:3000/favicon.ico')
  })
})

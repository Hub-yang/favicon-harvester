import type { IconCandidate } from './types'
import { describe, expect, it } from 'vitest'
import { findSizeMismatch } from './size-mismatch'

function candidate(overrides: Partial<IconCandidate> = {}): IconCandidate {
  return {
    url: 'https://example.com/apple-touch-icon.png',
    source: 'link',
    mimeType: 'image/png',
    width: 32,
    height: 32,
    declaredSizes: [{ width: 180, height: 180 }],
    ...overrides,
  }
}

describe('findSizeMismatch', () => {
  it('实测不在声明里时报出声明列表与实测值', () => {
    expect(findSizeMismatch(candidate())).toEqual({
      declared: [{ width: 180, height: 180 }],
      actual: { width: 32, height: 32 },
    })
  })

  it('实测与声明一致时不报', () => {
    expect(findSizeMismatch(candidate({ width: 180, height: 180 }))).toBeUndefined()
  })

  it('多值声明里命中任意一个就不报（多帧 ICO 的常见写法）', () => {
    const declaredSizes = [{ width: 16, height: 16 }, { width: 32, height: 32 }, { width: 48, height: 48 }]
    expect(findSizeMismatch(candidate({ width: 48, height: 48, declaredSizes }))).toBeUndefined()
    expect(findSizeMismatch(candidate({ width: 64, height: 64, declaredSizes }))).toEqual({
      declared: declaredSizes,
      actual: { width: 64, height: 64 },
    })
  })

  it('宽高要同时对上：只有宽相同不算一致', () => {
    expect(findSizeMismatch(candidate({ width: 180, height: 90 }))?.actual).toEqual({ width: 180, height: 90 })
  })

  it('没有声明尺寸时不报', () => {
    expect(findSizeMismatch(candidate({ declaredSizes: undefined }))).toBeUndefined()
    expect(findSizeMismatch(candidate({ declaredSizes: [] }))).toBeUndefined()
  })

  it('没有实测尺寸时不报', () => {
    expect(findSizeMismatch(candidate({ width: undefined, height: undefined }))).toBeUndefined()
    expect(findSizeMismatch(candidate({ height: undefined }))).toBeUndefined()
  })

  it('矢量图 SVG 不比对尺寸', () => {
    expect(findSizeMismatch(candidate({ mimeType: 'image/svg+xml' }))).toBeUndefined()
    expect(findSizeMismatch(candidate({ mimeType: undefined, url: 'https://example.com/icon.svg' }))).toBeUndefined()
  })
})

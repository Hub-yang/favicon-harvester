import { describe, expect, it } from 'vitest'
import { buildTabFavIconCandidate } from './tab-favicon-candidate'

describe('buildTabFavIconCandidate', () => {
  it('有 favIconUrl 时包装为 tab 来源候选', () => {
    expect(buildTabFavIconCandidate('https://example.com/favicon.ico')).toEqual({
      url: 'https://example.com/favicon.ico',
      source: 'tab',
    })
  })

  it('undefined 时返回 undefined', () => {
    expect(buildTabFavIconCandidate(undefined)).toBeUndefined()
  })

  it('空字符串时返回 undefined', () => {
    expect(buildTabFavIconCandidate('')).toBeUndefined()
  })
})

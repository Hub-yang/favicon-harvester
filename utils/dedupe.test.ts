import type { IconCandidate } from './types'
import { describe, expect, it } from 'vitest'
import { dedupeByAbsoluteUrl } from './dedupe'

function candidate(overrides: Partial<IconCandidate> & Pick<IconCandidate, 'url' | 'source'>): IconCandidate {
  return { ...overrides }
}

describe('dedupeByAbsoluteUrl', () => {
  it('多来源同 URL 时保留优先级靠前（先出现）的那个', () => {
    const linkCandidate = candidate({ url: 'https://example.com/favicon.ico', source: 'link', sourceDetail: 'icon' })
    const wellKnownCandidate = candidate({ url: 'https://example.com/favicon.ico', source: 'well-known', sourceDetail: 'favicon.ico' })

    const result = dedupeByAbsoluteUrl([linkCandidate, wellKnownCandidate])

    expect(result).toEqual([linkCandidate])
  })

  it('无重复场景下数量与内容都不变', () => {
    const candidates = [
      candidate({ url: 'https://example.com/a.png', source: 'link' }),
      candidate({ url: 'https://example.com/b.png', source: 'manifest' }),
      candidate({ url: 'https://example.com/c.png', source: 'well-known', sourceDetail: 'c.png' }),
    ]

    expect(dedupeByAbsoluteUrl(candidates)).toEqual(candidates)
  })

  it('空数组返回空数组', () => {
    expect(dedupeByAbsoluteUrl([])).toEqual([])
  })
})

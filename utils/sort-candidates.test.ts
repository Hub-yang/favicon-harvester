import type { IconCandidate } from './types'
import { describe, expect, it } from 'vitest'
import { sortCandidatesBySize } from './sort-candidates'

function candidate(overrides: Partial<IconCandidate> & Pick<IconCandidate, 'url'>): IconCandidate {
  return { source: 'link', ...overrides }
}

describe('sortCandidatesBySize', () => {
  it('按面积降序排列有尺寸的候选', () => {
    const small = candidate({ url: 'https://example.com/16.png', width: 16, height: 16 })
    const large = candidate({ url: 'https://example.com/180.png', width: 180, height: 180 })
    const medium = candidate({ url: 'https://example.com/64.png', width: 64, height: 64 })

    expect(sortCandidatesBySize([small, large, medium])).toEqual([large, medium, small])
  })

  it('尺寸未知的候选排在所有已知尺寸之后', () => {
    const unknown = candidate({ url: 'https://example.com/f.ico', source: 'well-known', sourceDetail: 'favicon.ico' })
    const tiny = candidate({ url: 'https://example.com/16.png', width: 16, height: 16 })

    expect(sortCandidatesBySize([unknown, tiny])).toEqual([tiny, unknown])
  })

  it('矢量图（SVG）排在所有位图之前，即使它自身解析出的尺寸更小', () => {
    const bitmap = candidate({ url: 'https://example.com/512.png', width: 512, height: 512 })
    const svg = candidate({ url: 'https://example.com/icon.svg', width: 16, height: 16, mimeType: 'image/svg+xml' })

    expect(sortCandidatesBySize([bitmap, svg])).toEqual([svg, bitmap])
  })

  it('仅凭 .svg 后缀、缺少 mimeType 的候选同样按矢量图处理', () => {
    const bitmap = candidate({ url: 'https://example.com/512.png', width: 512, height: 512 })
    const svg = candidate({ url: 'https://example.com/icon.svg' })

    expect(sortCandidatesBySize([bitmap, svg])).toEqual([svg, bitmap])
  })

  it('面积相同的候选保持原有发现顺序', () => {
    const first = candidate({ url: 'https://example.com/a.png', source: 'link', width: 32, height: 32 })
    const second = candidate({ url: 'https://example.com/b.png', source: 'manifest', width: 32, height: 32 })

    expect(sortCandidatesBySize([first, second])).toEqual([first, second])
  })

  it('多个 SVG 之间保持原有发现顺序', () => {
    const first = candidate({ url: 'https://example.com/a.svg', source: 'link' })
    const second = candidate({ url: 'https://example.com/b.svg', source: 'manifest' })

    expect(sortCandidatesBySize([first, second])).toEqual([first, second])
  })

  it('不修改传入的数组', () => {
    const input = [
      candidate({ url: 'https://example.com/16.png', width: 16, height: 16 }),
      candidate({ url: 'https://example.com/64.png', width: 64, height: 64 }),
    ]
    const snapshot = [...input]

    sortCandidatesBySize(input)

    expect(input).toEqual(snapshot)
  })

  it('空数组返回空数组', () => {
    expect(sortCandidatesBySize([])).toEqual([])
  })
})

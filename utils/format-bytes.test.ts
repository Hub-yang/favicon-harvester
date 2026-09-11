import { describe, expect, it } from 'vitest'
import { formatBytes } from './format-bytes'

describe('formatBytes', () => {
  it('不足 1 KB 时按字节整数显示', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1)).toBe('1 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('小于 10 的数值保留一位小数，便于区分 1.2 KB 和 1.9 KB', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(4300)).toBe('4.2 KB')
  })

  it('整数值不带多余的 .0 尾巴', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
  })

  it('大于等于 10 的数值取整，避免小数位挤占卡片宽度', () => {
    expect(formatBytes(10240)).toBe('10 KB')
    expect(formatBytes(131072)).toBe('128 KB')
  })

  it('超过 1 MB 时进位到 MB', () => {
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB')
  })
})

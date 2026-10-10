import type { DomScanResult } from '../types'
import { describe, expect, it } from 'vitest'
import { buildDomCandidates } from './dom-candidates'

describe('buildDomCandidates', () => {
  it('把 DOM 扫描结果转成 link 来源候选，rel 存入 sourceDetail', () => {
    const scan: DomScanResult = {
      icons: [
        { href: 'https://example.com/icon.png', rel: 'icon', sizes: '32x32' },
      ],
    }

    expect(buildDomCandidates(scan)).toEqual([
      {
        url: 'https://example.com/icon.png',
        source: 'link',
        sourceDetail: 'icon',
        width: 32,
        height: 32,
        declaredSizes: [{ width: 32, height: 32 }],
      },
    ])
  })

  it('多值 sizes：width/height 取第一个，declaredSizes 全部保留', () => {
    const scan: DomScanResult = {
      icons: [
        { href: 'https://example.com/favicon.ico', rel: 'icon', sizes: '16x16 32x32 48x48' },
      ],
    }

    expect(buildDomCandidates(scan)[0]).toMatchObject({
      width: 16,
      height: 16,
      declaredSizes: [{ width: 16, height: 16 }, { width: 32, height: 32 }, { width: 48, height: 48 }],
    })
  })

  it('无 sizes 时 width/height 为 undefined', () => {
    const scan: DomScanResult = {
      icons: [
        { href: 'https://example.com/mask.svg', rel: 'mask-icon' },
      ],
    }

    expect(buildDomCandidates(scan)).toEqual([
      {
        url: 'https://example.com/mask.svg',
        source: 'link',
        sourceDetail: 'mask-icon',
        width: undefined,
        height: undefined,
      },
    ])
  })

  it('无 sizes 或 sizes="any" 时不带 declaredSizes 字段（没有声明就无从比对）', () => {
    const scan: DomScanResult = {
      icons: [
        { href: 'https://example.com/a.svg', rel: 'icon' },
        { href: 'https://example.com/b.svg', rel: 'icon', sizes: 'any' },
      ],
    }

    for (const candidate of buildDomCandidates(scan))
      expect(candidate).not.toHaveProperty('declaredSizes')
  })

  it('保留原始顺序转换多个候选', () => {
    const scan: DomScanResult = {
      icons: [
        { href: 'https://example.com/a.png', rel: 'icon', sizes: '16x16' },
        { href: 'https://example.com/b.png', rel: 'apple-touch-icon', sizes: '180x180' },
      ],
    }

    const result = buildDomCandidates(scan)

    expect(result).toHaveLength(2)
    expect(result[0]?.sourceDetail).toBe('icon')
    expect(result[1]).toMatchObject({ source: 'link', sourceDetail: 'apple-touch-icon', width: 180, height: 180 })
  })

  it('空 icons 返回空数组', () => {
    expect(buildDomCandidates({ icons: [] })).toEqual([])
  })
})

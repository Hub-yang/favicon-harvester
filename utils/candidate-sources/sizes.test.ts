import { describe, expect, it } from 'vitest'
import { parseSizesAttribute } from './sizes'

describe('parseSizesAttribute', () => {
  it('解析标准 WxH 字符串', () => {
    expect(parseSizesAttribute('180x180')).toEqual([{ width: 180, height: 180 }])
  })

  it('大写 X 也能解析', () => {
    expect(parseSizesAttribute('32X32')).toEqual([{ width: 32, height: 32 }])
  })

  it('多值空格分隔时全部保留，顺序不变', () => {
    expect(parseSizesAttribute('512x512 256x256 16x16')).toEqual([
      { width: 512, height: 512 },
      { width: 256, height: 256 },
      { width: 16, height: 16 },
    ])
  })

  it('前后与中间的多余空白被裁剪', () => {
    expect(parseSizesAttribute('  48x48   96x96  ')).toEqual([{ width: 48, height: 48 }, { width: 96, height: 96 }])
  })

  it('undefined 与空字符串返回空数组', () => {
    expect(parseSizesAttribute(undefined)).toEqual([])
    expect(parseSizesAttribute('')).toEqual([])
    expect(parseSizesAttribute('   ')).toEqual([])
  })

  it('"any"（矢量图 sizes）不算声明尺寸', () => {
    expect(parseSizesAttribute('any')).toEqual([])
  })

  it('跳过非法值，保留同一串里的合法值', () => {
    expect(parseSizesAttribute('any 32x32')).toEqual([{ width: 32, height: 32 }])
    expect(parseSizesAttribute('180 64x64 180*180 wxh')).toEqual([{ width: 64, height: 64 }])
  })

  it('全部非法时返回空数组', () => {
    expect(parseSizesAttribute('180')).toEqual([])
    expect(parseSizesAttribute('180*180')).toEqual([])
    expect(parseSizesAttribute('wxh')).toEqual([])
  })
})

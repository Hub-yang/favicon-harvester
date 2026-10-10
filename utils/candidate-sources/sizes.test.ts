import { describe, expect, it } from 'vitest'
import { parseSizesAttribute } from './sizes'

describe('parseSizesAttribute', () => {
  it('解析标准 WxH 字符串', () => {
    expect(parseSizesAttribute('180x180')).toEqual({ width: 180, height: 180 })
  })

  it('大写 X 也能解析', () => {
    expect(parseSizesAttribute('32X32')).toEqual({ width: 32, height: 32 })
  })

  it('多值空格分隔时取第一个', () => {
    expect(parseSizesAttribute('512x512 256x256 16x16')).toEqual({ width: 512, height: 512 })
  })

  it('前后空白被裁剪', () => {
    expect(parseSizesAttribute('  48x48  ')).toEqual({ width: 48, height: 48 })
  })

  it('undefined 返回 undefined', () => {
    expect(parseSizesAttribute(undefined)).toBeUndefined()
  })

  it('空字符串返回 undefined', () => {
    expect(parseSizesAttribute('')).toBeUndefined()
  })

  it('"any"（矢量图 sizes）返回 undefined', () => {
    expect(parseSizesAttribute('any')).toBeUndefined()
  })

  it('非 WxH 格式返回 undefined', () => {
    expect(parseSizesAttribute('180')).toBeUndefined()
    expect(parseSizesAttribute('180*180')).toBeUndefined()
    expect(parseSizesAttribute('wxh')).toBeUndefined()
  })
})

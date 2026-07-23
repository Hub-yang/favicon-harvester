import { describe, expect, it } from 'vitest'
import { parseSvgSize } from './svg-size'

describe('parseSvgSize', () => {
  it('width/height 齐全时直接解析', () => {
    expect(parseSvgSize('<svg width="24" height="24" viewBox="0 0 48 48"></svg>')).toEqual({ width: 24, height: 24 })
  })

  it('仅有 viewBox 时退化解析第3/4个数值', () => {
    expect(parseSvgSize('<svg viewBox="0 0 32 32"></svg>')).toEqual({ width: 32, height: 32 })
  })

  it('viewBox 用逗号分隔也能解析', () => {
    expect(parseSvgSize('<svg viewBox="0,0,32,32"></svg>')).toEqual({ width: 32, height: 32 })
  })

  it('剥离 px 单位后缀', () => {
    expect(parseSvgSize('<svg width="24px" height="24px"></svg>')).toEqual({ width: 24, height: 24 })
  })

  it('百分比等非数值单位判定无效，退化到 viewBox', () => {
    expect(parseSvgSize('<svg width="100%" height="100%" viewBox="0 0 16 16"></svg>')).toEqual({ width: 16, height: 16 })
  })

  it('百分比且无 viewBox 时返回 undefined', () => {
    expect(parseSvgSize('<svg width="100%" height="100%"></svg>')).toBeUndefined()
  })

  it('属性顺序无关', () => {
    expect(parseSvgSize('<svg height="20" width="20"></svg>')).toEqual({ width: 20, height: 20 })
  })

  it('单引号属性值也能解析', () => {
    expect(parseSvgSize(`<svg width='18' height='18'></svg>`)).toEqual({ width: 18, height: 18 })
  })

  it('stroke-width 不应被误判为 width', () => {
    expect(parseSvgSize('<svg stroke-width="2" width="30" height="30"></svg>')).toEqual({ width: 30, height: 30 })
  })

  it('没有 svg 根标签时返回 undefined', () => {
    expect(parseSvgSize('not an svg')).toBeUndefined()
  })

  it('svg 标签存在但没有任何尺寸信息时返回 undefined', () => {
    expect(parseSvgSize('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeUndefined()
  })
})

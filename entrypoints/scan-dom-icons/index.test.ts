import { afterEach, describe, expect, it } from 'vitest'
import { scanDomIcons } from './index'

describe('scanDomIcons', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('收集各类图标 rel 的 link，并带出 sizes', () => {
    document.head.innerHTML = `
      <link rel="icon" href="/favicon.ico">
      <link rel="shortcut icon" href="/favicon.ico">
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
      <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon-precomposed.png">
      <link rel="mask-icon" href="/mask-icon.svg" color="#000000">
    `

    const result = scanDomIcons(document)

    expect(result.icons).toHaveLength(5)
    expect(result.icons.every(icon => icon.href.startsWith('http'))).toBe(true)

    const appleTouchIcon = result.icons.find(icon => icon.rel === 'apple-touch-icon')
    expect(appleTouchIcon?.sizes).toBe('180x180')

    const maskIcon = result.icons.find(icon => icon.rel === 'mask-icon')
    expect(maskIcon?.sizes).toBeUndefined()
  })

  it('rel 大小写变体依然命中', () => {
    document.head.innerHTML = `<link REL="ICON" href="/favicon.ico">`

    const result = scanDomIcons(document)

    expect(result.icons).toHaveLength(1)
    expect(result.icons[0]?.rel).toBe('icon')
  })

  it('忽略不相关的 link（如 alternate）', () => {
    document.head.innerHTML = `<link rel="alternate" href="/feed.xml">`

    const result = scanDomIcons(document)

    expect(result.icons).toHaveLength(0)
  })

  it('识别 manifest link 为 manifestHref', () => {
    document.head.innerHTML = `<link rel="manifest" href="/site.webmanifest">`

    const result = scanDomIcons(document)

    expect(result.manifestHref).toMatch(/\/site\.webmanifest$/)
  })

  it('没有 manifest link 时 manifestHref 为 undefined', () => {
    document.head.innerHTML = `<link rel="icon" href="/favicon.ico">`

    const result = scanDomIcons(document)

    expect(result.manifestHref).toBeUndefined()
  })

  it('空 head 场景返回空结果，不抛异常', () => {
    const result = scanDomIcons(document)

    expect(result).toEqual({ icons: [], manifestHref: undefined })
  })
})

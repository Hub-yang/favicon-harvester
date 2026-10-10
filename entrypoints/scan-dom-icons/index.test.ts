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

  it('rel 是多值时，任一值是图标类型就命中（如 alternate icon）', () => {
    document.head.innerHTML = `
      <link rel="alternate icon" href="/favicon.png">
      <link rel="icon shortcut" href="/a.ico">
      <link rel="preload apple-touch-icon" href="/b.png">
    `

    const result = scanDomIcons(document)

    expect(result.icons.map(icon => icon.rel)).toEqual(['alternate icon', 'icon shortcut', 'preload apple-touch-icon'])
  })

  it('rel 里的多余空白、制表符、换行被规整成单个空格', () => {
    document.head.innerHTML = `<link rel="  Alternate\t\n  ICON  " href="/favicon.png">`

    const result = scanDomIcons(document)

    expect(result.icons).toHaveLength(1)
    expect(result.icons[0]?.rel).toBe('alternate icon')
  })

  it('不误收只是名字里带 icon 的其他 rel（如 apple-touch-startup-image、fluid-icon）', () => {
    document.head.innerHTML = `
      <link rel="apple-touch-startup-image" href="/splash.png">
      <link rel="fluid-icon" href="/fluidicon.png">
    `

    expect(scanDomIcons(document).icons).toHaveLength(0)
  })

  it('rel 多值里含 manifest 时识别为 manifestHref', () => {
    document.head.innerHTML = `<link rel="preload manifest" href="/site.webmanifest">`

    expect(scanDomIcons(document).manifestHref).toMatch(/\/site\.webmanifest$/)
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

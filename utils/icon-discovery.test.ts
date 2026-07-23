import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { discoverIcons } from './icon-discovery'

function makeTab(overrides: Partial<Browser.tabs.Tab> = {}): Browser.tabs.Tab {
  return {
    index: 0,
    windowId: 1,
    pinned: false,
    highlighted: false,
    active: true,
    frozen: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    groupId: -1,
    id: 1,
    url: 'https://example.com/',
    favIconUrl: 'https://example.com/favicon.ico',
    ...overrides,
  }
}

describe('discoverIcons', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('url 预判命中受限模式时不调用 executeScript，直接返回 tab favicon 兜底', async () => {
    const executeScriptSpy = vi.spyOn(fakeBrowser.scripting, 'executeScript')
    const tab = makeTab({ url: 'chrome://extensions' })

    const result = await discoverIcons(tab)

    expect(executeScriptSpy).not.toHaveBeenCalled()
    expect(result).toEqual({
      restricted: true,
      candidates: [{ url: 'https://example.com/favicon.ico', source: 'tab' }],
    })
  })

  it('executeScript 抛错时归为受限，仍返回 tab favicon 兜底', async () => {
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockRejectedValue(new Error('boom'))
    const tab = makeTab()

    const result = await discoverIcons(tab)

    expect(result).toEqual({
      restricted: true,
      candidates: [{ url: 'https://example.com/favicon.ico', source: 'tab' }],
    })
  })

  it('正常路径下收集并探测候选，探测失败的候选被过滤', async () => {
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockResolvedValue([
      {
        frameId: 0,
        result: {
          icons: [{ href: 'https://example.com/icon.png', rel: 'icon', sizes: '32x32' }],
          manifestHref: undefined,
        },
      },
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    const tab = makeTab()

    const result = await discoverIcons(tab)

    expect(result.restricted).toBe(false)
    expect(result.candidates).toEqual([])
  })
})

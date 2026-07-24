import type { ScanResult } from '@/utils/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { sendMessage } from '@/utils/messaging'
import { verifyImageLoadable } from '@/utils/verify-image-loadable'
import App from './App.vue'
import IconCard from './components/IconCard.vue'
import ScanRetryPanel from './components/ScanRetryPanel.vue'
import StatusBanner from './components/StatusBanner.vue'

vi.mock('@/utils/messaging', () => ({ sendMessage: vi.fn() }))
vi.mock('@/utils/verify-image-loadable', () => ({ verifyImageLoadable: vi.fn() }))

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
    url: 'https://github.com/some/repo',
    ...overrides,
  }
}

function stubActiveTab(tab: Browser.tabs.Tab) {
  vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([tab])
}

describe('app', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    // 默认让候选都验证通过，未特别覆盖 verifyImageLoadable 的用例保持原有断言不变
    vi.mocked(verifyImageLoadable).mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('挂载后、扫描返回前处于 loading 态', () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}) as ReturnType<typeof sendMessage>)

    const wrapper = mount(App)

    expect(wrapper.findComponent(StatusBanner).props('state')).toBe('loading')
  })

  it('受限结果：显示 restricted 横幅，同时渲染兜底候选', async () => {
    stubActiveTab(makeTab())
    const result: ScanResult = {
      restricted: true,
      candidates: [{ url: 'https://github.com/favicon.ico', source: 'tab' }],
    }
    vi.mocked(sendMessage).mockResolvedValue(result as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.findComponent(StatusBanner).props('state')).toBe('restricted')
    expect(wrapper.findAllComponents(IconCard)).toHaveLength(1)
  })

  it('空结果：显示重试面板（no-results），无候选卡片', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.findComponent(ScanRetryPanel).props('state')).toBe('no-results')
    expect(wrapper.findAllComponents(IconCard)).toHaveLength(0)
  })

  it('正常结果：无横幅，渲染候选列表，并把域名透传给 IconCard', async () => {
    stubActiveTab(makeTab({ url: 'https://github.com/some/repo' }))
    const result: ScanResult = {
      restricted: false,
      candidates: [
        { url: 'https://github.com/a.png', source: 'link', width: 32, height: 32 },
        { url: 'https://github.com/favicon.ico', source: 'well-known', sourceDetail: 'favicon.ico' },
      ],
    }
    vi.mocked(sendMessage).mockResolvedValue(result as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.findComponent(StatusBanner).exists()).toBe(false)
    const cards = wrapper.findAllComponents(IconCard)
    expect(cards).toHaveLength(2)
    expect(cards[0]?.props('domain')).toBe('github.com')
    // scanIcons 用 active tab 的 id 发起
    expect(sendMessage).toHaveBeenCalledWith('scanIcons', { tabId: 1 })
  })

  it('候选通过后台探测但全部渲染验证失败：不展示任何卡片，显示重试面板（回归用例）', async () => {
    stubActiveTab(makeTab())
    const result: ScanResult = {
      restricted: false,
      candidates: [
        { url: 'https://huberyyang.site:85/favicon.ico', source: 'well-known', sourceDetail: 'favicon.ico' },
        { url: 'https://huberyyang.site:85/favicon.png', source: 'well-known', sourceDetail: 'favicon.png' },
      ],
    }
    vi.mocked(sendMessage).mockResolvedValue(result as Awaited<ReturnType<typeof sendMessage>>)
    vi.mocked(verifyImageLoadable).mockResolvedValue(false)

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.findAllComponents(IconCard)).toHaveLength(0)
    expect(wrapper.findComponent(ScanRetryPanel).props('state')).toBe('no-results')
  })

  it('点击重试面板按钮，重新扫描成功后卡片正常展示，面板消失', async () => {
    vi.useFakeTimers()
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.findComponent(ScanRetryPanel).exists()).toBe(true)

    vi.mocked(sendMessage).mockResolvedValue({
      restricted: false,
      candidates: [{ url: 'https://github.com/a.png', source: 'link' }],
    } as Awaited<ReturnType<typeof sendMessage>>)

    await wrapper.findComponent(ScanRetryPanel).vm.$emit('retry')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()

    expect(wrapper.findComponent(ScanRetryPanel).exists()).toBe(false)
    expect(wrapper.findAllComponents(IconCard)).toHaveLength(1)

    vi.useRealTimers()
  })
})

import type { ScanResult } from '@/utils/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { sendMessage } from '@/utils/messaging'
import { verifyImageLoadable } from '@/utils/verify-image-loadable'
import App from './App.vue'
import IconCard from './components/IconCard.vue'
import IconToolbar from './components/IconToolbar.vue'
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
    // fakeBrowser.runtime.getManifest 默认未实现，App.vue 头部展示版本号需要用到，这里手动 stub
    vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
      manifest_version: 3,
      name: '图标提取器',
      version: '0.1.0',
    } as any)
    // 默认让候选都验证通过，未特别覆盖 verifyImageLoadable 的用例保持原有断言不变
    vi.mocked(verifyImageLoadable).mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('头部标题右侧展示 manifest 中的版本号', () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockReturnValue(new Promise(() => {}) as ReturnType<typeof sendMessage>)

    const wrapper = mount(App)

    expect(wrapper.find('header').text()).toContain('v0.1.0')
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

  describe('批量下载工具栏', () => {
    it('有候选时展示工具栏', async () => {
      stubActiveTab(makeTab())
      vi.mocked(sendMessage).mockResolvedValue({
        restricted: false,
        candidates: [{ url: 'https://github.com/a.png', source: 'link' }],
      } as Awaited<ReturnType<typeof sendMessage>>)

      const wrapper = mount(App)
      await flushPromises()

      expect(wrapper.findComponent(IconToolbar).exists()).toBe(true)
    })

    it('没有候选时不展示工具栏，避免出现"0 个图标"的空工具条', async () => {
      stubActiveTab(makeTab())
      vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

      const wrapper = mount(App)
      await flushPromises()

      expect(wrapper.findComponent(IconToolbar).exists()).toBe(false)
    })

    it('工具栏触发 download 后为每个候选各发一次下载消息', async () => {
      stubActiveTab(makeTab())
      vi.mocked(sendMessage).mockResolvedValue({
        restricted: false,
        candidates: [
          { url: 'https://github.com/a.png', source: 'link', width: 32, height: 32 },
          { url: 'https://github.com/b.png', source: 'manifest', width: 16, height: 16 },
        ],
      } as Awaited<ReturnType<typeof sendMessage>>)

      const wrapper = mount(App)
      await flushPromises()

      vi.mocked(sendMessage).mockResolvedValue({ success: true } as Awaited<ReturnType<typeof sendMessage>>)
      wrapper.findComponent(IconToolbar).vm.$emit('download')
      await flushPromises()

      const downloadCalls = vi.mocked(sendMessage).mock.calls.filter(([type]) => type === 'downloadIcon')
      expect(downloadCalls.map(([, data]) => (data as { filename: string }).filename)).toEqual([
        'github.com-link-32x32.png',
        'github.com-manifest-16x16.png',
      ])
    })
  })
})

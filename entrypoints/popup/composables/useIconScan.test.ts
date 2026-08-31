import type { ScanResult } from '@/utils/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { sendMessage } from '@/utils/messaging'
import { verifyImageLoadable } from '@/utils/verify-image-loadable'
import { useIconScan } from './useIconScan'

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
    url: 'https://example.com/some/page',
    ...overrides,
  }
}

function stubActiveTab(tab: Browser.tabs.Tab) {
  vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([tab])
}

function mountScan() {
  const Harness = defineComponent({
    setup: () => useIconScan(),
    template: '<div />',
  })
  return mount(Harness)
}

async function advanceDebounce() {
  await vi.advanceTimersByTimeAsync(300)
}

const CANDIDATE_A: ScanResult['candidates'][number] = { url: 'https://example.com/a.png', source: 'link' }
const CANDIDATE_B: ScanResult['candidates'][number] = { url: 'https://example.com/b.png', source: 'well-known', sourceDetail: 'favicon.ico' }

describe('useIconScan', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('初次扫描 0 候选：显示重试面板，不计入重试次数', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountScan()
    await flushPromises()

    expect(wrapper.vm.showRetryPanel).toBe(true)
    expect(wrapper.vm.exhausted).toBe(false)
  })

  it('初次扫描候选全部渲染验证失败：同样显示重试面板，不计入重试次数', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [CANDIDATE_A, CANDIDATE_B] } as Awaited<ReturnType<typeof sendMessage>>)
    vi.mocked(verifyImageLoadable).mockResolvedValue(false)

    const wrapper = mountScan()
    await flushPromises()

    expect(wrapper.vm.candidates).toHaveLength(0)
    expect(wrapper.vm.showRetryPanel).toBe(true)
    expect(wrapper.vm.exhausted).toBe(false)

    // 紧接着手动重试一次仍失败，验证次数是从 0 起算（而非把初次失败也算进去）
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)
    wrapper.vm.retry()
    await advanceDebounce()
    await flushPromises()

    expect(wrapper.vm.exhausted).toBe(false)
  })

  it('初次扫描成功：候选非空，不显示重试面板', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [CANDIDATE_A] } as Awaited<ReturnType<typeof sendMessage>>)
    vi.mocked(verifyImageLoadable).mockResolvedValue(true)

    const wrapper = mountScan()
    await flushPromises()

    expect(wrapper.vm.candidates).toHaveLength(1)
    expect(wrapper.vm.showRetryPanel).toBe(false)
  })

  it('扫描结果按尺寸降序暴露，尺寸未知的候选垫底', async () => {
    const small = { url: 'https://example.com/16.png', source: 'link' as const, width: 16, height: 16 }
    const unknown = { url: 'https://example.com/f.ico', source: 'well-known' as const, sourceDetail: 'favicon.ico' }
    const large = { url: 'https://example.com/180.png', source: 'link' as const, width: 180, height: 180 }
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [small, unknown, large] } as Awaited<ReturnType<typeof sendMessage>>)
    vi.mocked(verifyImageLoadable).mockResolvedValue(true)

    const wrapper = mountScan()
    await flushPromises()

    expect(wrapper.vm.candidates.map(candidate => candidate.url)).toEqual([large.url, small.url, unknown.url])
  })

  it('连续 3 次手动重试都失败后进入终止态，第 4 次点击不再发请求', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountScan()
    await flushPromises()
    expect(wrapper.vm.showRetryPanel).toBe(true)

    for (const expectedCount of [1, 2, 3]) {
      wrapper.vm.retry()
      await advanceDebounce()
      await flushPromises()
      expect(wrapper.vm.exhausted).toBe(expectedCount >= 3)
    }

    expect(wrapper.vm.exhausted).toBe(true)
    expect(wrapper.vm.showRetryPanel).toBe(true)

    const callCountBeforeExtraClick = vi.mocked(sendMessage).mock.calls.length
    wrapper.vm.retry()
    await advanceDebounce()
    await flushPromises()

    expect(vi.mocked(sendMessage).mock.calls.length).toBe(callCountBeforeExtraClick)
  })

  it('重试中途成功后计数归零', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountScan()
    await flushPromises()

    wrapper.vm.retry()
    await advanceDebounce()
    await flushPromises()

    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [CANDIDATE_A] } as Awaited<ReturnType<typeof sendMessage>>)
    vi.mocked(verifyImageLoadable).mockResolvedValue(true)
    wrapper.vm.retry()
    await advanceDebounce()
    await flushPromises()

    expect(wrapper.vm.showRetryPanel).toBe(false)
    expect(wrapper.vm.exhausted).toBe(false)

    // 之后即使再次全部失败，也是从 0 重新计数
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)
    wrapper.vm.retry()
    await advanceDebounce()
    await flushPromises()

    expect(wrapper.vm.exhausted).toBe(false)
  })

  it('防抖窗口内连续点击重试，只发一次请求', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountScan()
    await flushPromises()
    vi.mocked(sendMessage).mockClear()

    wrapper.vm.retry()
    wrapper.vm.retry()
    wrapper.vm.retry()
    await advanceDebounce()
    await flushPromises()

    expect(sendMessage).toHaveBeenCalledTimes(1)
  })

  it('防抖窗口外但上一次重试请求尚未返回时再次点击，仍只发一次请求', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [] } as Awaited<ReturnType<typeof sendMessage>>)

    const wrapper = mountScan()
    await flushPromises()

    let resolveScan: (result: ScanResult) => void = () => {}
    vi.mocked(sendMessage).mockClear()
    vi.mocked(sendMessage).mockReturnValue(new Promise((resolve) => {
      resolveScan = resolve as (result: ScanResult) => void
    }) as ReturnType<typeof sendMessage>)

    wrapper.vm.retry()
    await advanceDebounce()
    // 上一次请求仍未 resolve 时再次点击，超过防抖窗口也应被 retrying guard 拦下
    wrapper.vm.retry()
    await advanceDebounce()

    expect(sendMessage).toHaveBeenCalledTimes(1)

    resolveScan({ restricted: false, candidates: [] })
    await flushPromises()
  })

  it('removeCandidate 摘除最后一个候选后显示重试面板，且不影响重试次数', async () => {
    stubActiveTab(makeTab())
    vi.mocked(sendMessage).mockResolvedValue({ restricted: false, candidates: [CANDIDATE_A] } as Awaited<ReturnType<typeof sendMessage>>)
    vi.mocked(verifyImageLoadable).mockResolvedValue(true)

    const wrapper = mountScan()
    await flushPromises()
    expect(wrapper.vm.showRetryPanel).toBe(false)

    wrapper.vm.removeCandidate(CANDIDATE_A.url)
    await flushPromises()

    expect(wrapper.vm.candidates).toHaveLength(0)
    expect(wrapper.vm.showRetryPanel).toBe(true)
    expect(wrapper.vm.exhausted).toBe(false)
  })
})

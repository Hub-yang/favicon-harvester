import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import App from './App.vue'

vi.mock('@/utils/messaging', () => ({ sendMessage: vi.fn().mockResolvedValue(undefined) }))

describe('自动扫描设置', () => {
  let onRemoved: () => void
  beforeEach(() => {
    fakeBrowser.reset()
    vi.spyOn(fakeBrowser.permissions.onAdded, 'addListener').mockImplementation(() => {})
    vi.spyOn(fakeBrowser.permissions.onAdded, 'removeListener').mockImplementation(() => {})
    vi.spyOn(fakeBrowser.permissions.onRemoved, 'addListener').mockImplementation((listener) => {
      onRemoved = () => listener({ origins: ['https://example.test/*'] })
    })
    vi.spyOn(fakeBrowser.permissions.onRemoved, 'removeListener').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('授权说明明确可用图标数量、开关保存在本机及随时停用', async () => {
    vi.spyOn(fakeBrowser.permissions, 'getAll').mockResolvedValue({ origins: [] })
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('授权后，扩展会自动扫描当前网页并显示可用图标数量。它只在本机保存开关，你可以随时停用。')
    wrapper.unmount()
  })

  it('授权期间不能重复请求，拒绝后仍维持关闭', async () => {
    let finish!: (granted: boolean) => void
    const request = vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation(() => new Promise(resolve => finish = resolve))
    vi.spyOn(fakeBrowser.permissions, 'getAll').mockResolvedValue({ origins: [] })
    const write = vi.spyOn(fakeBrowser.storage.local, 'set')
    const wrapper = mount(App)
    await flushPromises()

    const enable = wrapper.get('button[data-action="enable"]')
    await enable.trigger('click')
    expect(enable.attributes('disabled')).toBeDefined()
    await enable.trigger('click')
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith({ origins: ['http://*/*', 'https://*/*'] })
    expect(write).not.toHaveBeenCalled()

    finish(false)
    await flushPromises()
    expect(write).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('未获得站点访问权限')
    expect(enable.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('授权后只持久化开关', async () => {
    vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(true)
    const permissions = vi.spyOn(fakeBrowser.permissions, 'getAll').mockResolvedValue({ origins: [] })
    const write = vi.spyOn(fakeBrowser.storage.local, 'set')
    const wrapper = mount(App)
    await flushPromises()
    permissions.mockResolvedValue({ origins: ['https://*/*'] })
    await wrapper.get('button[data-action="enable"]').trigger('click')
    await flushPromises()
    expect(write).toHaveBeenCalledExactlyOnceWith({ autoScanEnabled: true })
    expect(wrapper.find('button[data-action="disable"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('只剩部分站点授权时先保存关闭，再尝试撤回，撤回失败也保持关闭', async () => {
    await fakeBrowser.storage.local.set({ autoScanEnabled: true })
    vi.spyOn(fakeBrowser.permissions, 'getAll').mockResolvedValue({ origins: ['https://example.test/*'] })
    const revoke = vi.spyOn(fakeBrowser.permissions, 'remove').mockImplementation(async (permissions) => {
      expect(permissions).toEqual({ origins: ['https://example.test/*'] })
      expect(await fakeBrowser.storage.local.get('autoScanEnabled')).toEqual({ autoScanEnabled: false })
      return false
    })
    const wrapper = mount(App)
    await flushPromises()
    await wrapper.get('button[data-action="disable"]').trigger('click')
    await flushPromises()
    expect(revoke).toHaveBeenCalledTimes(1)
    expect(wrapper.find('button[data-action="enable"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('未能撤回站点权限')
    wrapper.unmount()
  })

  it('另一个设置页改变开关后同步按钮', async () => {
    vi.spyOn(fakeBrowser.permissions, 'getAll').mockResolvedValue({ origins: [] })
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.find('button[data-action="disable"]').exists()).toBe(false)

    await fakeBrowser.storage.local.set({ autoScanEnabled: true })
    await flushPromises()
    expect(wrapper.find('button[data-action="disable"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('浏览器撤权时更新授权提示，不主动发起新请求', async () => {
    await fakeBrowser.storage.local.set({ autoScanEnabled: true })
    const permissions = vi.spyOn(fakeBrowser.permissions, 'getAll').mockResolvedValue({ origins: ['https://example.test/*'] })
    const request = vi.spyOn(fakeBrowser.permissions, 'request')
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Chrome 当前未授权任何站点')
    permissions.mockResolvedValue({ origins: [] })
    onRemoved?.()
    await flushPromises()
    expect(wrapper.text()).toContain('Chrome 当前未授权任何站点')
    expect(request).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

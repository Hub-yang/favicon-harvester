import type { IconCandidate } from '@/utils/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendMessage } from '@/utils/messaging'
import IconCard from './IconCard.vue'

vi.mock('@/utils/messaging', () => ({ sendMessage: vi.fn() }))

function mountCard(candidate: IconCandidate, domain = 'example.com') {
  return mount(IconCard, { props: { candidate, domain } })
}

describe('iconCard', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('展示', () => {
    it('有宽高时显示 W×H 尺寸', () => {
      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link', width: 24, height: 24 })

      expect(wrapper.text()).toContain('24×24')
    })

    it('无尺寸时回退到 sourceDetail', () => {
      const wrapper = mountCard({ url: 'https://example.com/f.ico', source: 'well-known', sourceDetail: 'favicon.ico' })

      expect(wrapper.text()).toContain('favicon.ico')
    })

    it('无尺寸且无 sourceDetail 时显示"尺寸未知"', () => {
      const wrapper = mountCard({ url: 'https://example.com/x', source: 'tab' })

      expect(wrapper.text()).toContain('尺寸未知')
    })

    it('展示来源中文标签与大写格式标签', () => {
      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'tab', mimeType: 'image/png' })

      expect(wrapper.text()).toContain('浏览器兜底')
      expect(wrapper.text()).toContain('PNG')
    })

    it('缩略图加载失败时降级显示"失败"占位', async () => {
      const wrapper = mountCard({ url: 'https://example.com/broken.png', source: 'link' })

      await wrapper.get('img').trigger('error')

      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.text()).toContain('失败')
    })
  })

  describe('下载状态机', () => {
    it('点击后经历 下载中… → 已下载，并用 buildFilename 生成的文件名发消息', async () => {
      let resolveDownload: (v: { success: boolean }) => void = () => {}
      vi.mocked(sendMessage).mockReturnValue(new Promise((resolve) => {
        resolveDownload = resolve
      }) as ReturnType<typeof sendMessage>)

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link', width: 32, height: 32 })
      const button = wrapper.get('button')

      await button.trigger('click')

      // 进行中：按钮禁用且文案为"下载中…"
      expect(button.attributes('disabled')).toBeDefined()
      expect(button.text()).toBe('下载中…')
      expect(sendMessage).toHaveBeenCalledWith('downloadIcon', {
        url: 'https://example.com/a.png',
        filename: 'example.com-link-32x32.png',
      })

      resolveDownload({ success: true })
      await flushPromises()

      expect(button.text()).toBe('已下载')
      expect(button.attributes('disabled')).toBeUndefined()
    })

    it('下载失败时按钮文案变为"重试"', async () => {
      vi.mocked(sendMessage).mockResolvedValue({ success: false, error: 'boom' } as Awaited<ReturnType<typeof sendMessage>>)

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await wrapper.get('button').trigger('click')
      await flushPromises()

      expect(wrapper.get('button').text()).toBe('重试')
    })

    it('sendMessage 本身 reject（如扩展上下文失效）时按钮文案变为"重试"而非卡死', async () => {
      vi.mocked(sendMessage).mockRejectedValue(new Error('Extension context invalidated'))

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await wrapper.get('button').trigger('click')
      await flushPromises()

      const button = wrapper.get('button')
      expect(button.text()).toBe('重试')
      expect(button.attributes('disabled')).toBeUndefined()
    })
  })
})

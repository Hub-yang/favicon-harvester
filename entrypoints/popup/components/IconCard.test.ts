import type { IconCandidate } from '@/utils/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendMessage } from '@/utils/messaging'
import IconCard from './IconCard.vue'

vi.mock('@/utils/messaging', () => ({ sendMessage: vi.fn() }))

function mountCard(candidate: IconCandidate, domain = 'example.com') {
  return mount(IconCard, { props: { candidate, domain } })
}

function downloadButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.get('[data-testid="download-button"]')
}

function copyButton(wrapper: ReturnType<typeof mountCard>) {
  return wrapper.get('[data-testid="copy-button"]')
}

function stubClipboard(writeText: (text: string) => Promise<void> = async () => {}) {
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(writeText), write: vi.fn(async () => {}) } })
  return vi.mocked(navigator.clipboard.writeText)
}

/** happy-dom 没有 ClipboardItem，用一个记录构造入参的替身顶上 */
function stubClipboardItem() {
  const constructed: Record<string, Blob>[] = []
  class FakeClipboardItem {
    constructor(items: Record<string, Blob>) {
      constructed.push(items)
    }
  }
  vi.stubGlobal('ClipboardItem', FakeClipboardItem)
  return constructed
}

function option(wrapper: ReturnType<typeof mountCard>, kind: string) {
  return wrapper.get(`[data-testid="copy-option-${kind}"]`)
}

async function expand(wrapper: ReturnType<typeof mountCard>) {
  await copyButton(wrapper).trigger('click')
}

describe('iconCard', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
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

    it('缩略图加载失败时 emit load-error，交给父组件摘除该候选', async () => {
      const wrapper = mountCard({ url: 'https://example.com/broken.png', source: 'link' })

      await wrapper.get('img').trigger('error')

      expect(wrapper.emitted('loadError')).toEqual([['https://example.com/broken.png']])
    })
  })

  describe('下载状态机', () => {
    it('点击后经历 下载中… → 已下载，并用 buildFilename 生成的文件名发消息', async () => {
      let resolveDownload: (v: { success: boolean }) => void = () => {}
      vi.mocked(sendMessage).mockReturnValue(new Promise((resolve) => {
        resolveDownload = resolve
      }) as ReturnType<typeof sendMessage>)

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link', width: 32, height: 32 })
      const button = downloadButton(wrapper)

      await button.trigger('click')

      expect(button.attributes('disabled')).toBeDefined()
      expect(button.text()).toBe('下载中…')
      expect(sendMessage).toHaveBeenCalledWith('downloadIcon', {
        url: 'https://example.com/a.png',
        filename: 'favicon-harvester/example.com/example.com-link-32x32.png',
      })

      resolveDownload({ success: true })
      await flushPromises()

      expect(button.text()).toBe('已下载')
      expect(button.attributes('disabled')).toBeUndefined()
    })

    it('下载失败时按钮文案变为"重试"', async () => {
      vi.mocked(sendMessage).mockResolvedValue({ success: false, error: 'boom' } as Awaited<ReturnType<typeof sendMessage>>)

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await downloadButton(wrapper).trigger('click')
      await flushPromises()

      expect(downloadButton(wrapper).text()).toBe('重试')
    })

    it('sendMessage 本身 reject（如扩展上下文失效）时按钮文案变为"重试"而非卡死', async () => {
      vi.mocked(sendMessage).mockRejectedValue(new Error('Extension context invalidated'))

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await downloadButton(wrapper).trigger('click')
      await flushPromises()

      const button = downloadButton(wrapper)
      expect(button.text()).toBe('重试')
      expect(button.attributes('disabled')).toBeUndefined()
    })
  })

  describe('复制', () => {
    it('主按钮切换展开状态，收起时不渲染任何复制选项', async () => {
      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })

      expect(wrapper.find('[data-testid="copy-option-url"]').exists()).toBe(false)

      await expand(wrapper)
      expect(wrapper.find('[data-testid="copy-option-url"]').exists()).toBe(true)

      await copyButton(wrapper).trigger('click')
      expect(wrapper.find('[data-testid="copy-option-url"]').exists()).toBe(false)
    })

    it('「链接」写入候选的绝对 URL', async () => {
      const writeText = stubClipboard()

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await expand(wrapper)
      await option(wrapper, 'url').trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledWith('https://example.com/a.png')
      expect(option(wrapper, 'url').text()).toBe('已复制')
    })

    it('「<link>」写入拼好的 link 标签而不是裸 URL', async () => {
      const writeText = stubClipboard()

      const wrapper = mountCard({
        url: 'https://example.com/a.png',
        source: 'link',
        sourceDetail: 'icon',
        width: 32,
        height: 32,
        mimeType: 'image/png',
      })
      await expand(wrapper)
      await option(wrapper, 'link-tag').trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledWith('<link rel="icon" type="image/png" sizes="32x32" href="https://example.com/a.png">')
    })

    it('「Data URI」向 background 取字节后写入 data: 字符串', async () => {
      const writeText = stubClipboard()
      vi.mocked(sendMessage).mockResolvedValue({ success: true, base64: 'AAEC', mimeType: 'image/png' } as never)

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link', mimeType: 'image/png' })
      await expand(wrapper)
      await option(wrapper, 'data-uri').trigger('click')
      await flushPromises()

      expect(sendMessage).toHaveBeenCalledWith('fetchIconBytes', { url: 'https://example.com/a.png' })
      expect(writeText).toHaveBeenCalledWith('data:image/png;base64,AAEC')
    })

    it('「图片」把 PNG 字节作为 image/png 项写进剪贴板', async () => {
      stubClipboard()
      const constructed = stubClipboardItem()
      vi.mocked(sendMessage).mockResolvedValue({ success: true, base64: 'AAEC', mimeType: 'image/png' } as never)

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link', mimeType: 'image/png' })
      await expand(wrapper)
      await option(wrapper, 'image').trigger('click')
      await flushPromises()

      expect(navigator.clipboard.write).toHaveBeenCalled()
      expect(Object.keys(constructed[0]!)).toEqual(['image/png'])
      expect(constructed[0]!['image/png']!.type).toBe('image/png')
    })

    it('非 PNG 候选的「图片」选项禁用并说明原因，不做格式转换', async () => {
      const wrapper = mountCard({ url: 'https://example.com/a.ico', source: 'tab', mimeType: 'image/x-icon' })
      await expand(wrapper)

      expect(option(wrapper, 'image').attributes('disabled')).toBeDefined()
      expect(option(wrapper, 'image').attributes('title')).toBe('系统剪贴板只接受 PNG 格式的图片')
    })

    it('反馈只落在被点击的那个选项上，不串到其他选项', async () => {
      stubClipboard()

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await expand(wrapper)
      await option(wrapper, 'url').trigger('click')
      await flushPromises()

      expect(option(wrapper, 'url').text()).toBe('已复制')
      expect(option(wrapper, 'link-tag').text()).toBe('<link>')
    })

    it('反馈在 1.5 秒后回落，便于连续复制多个图标', async () => {
      vi.useFakeTimers()
      stubClipboard()

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await expand(wrapper)
      await option(wrapper, 'url').trigger('click')
      await flushPromises()
      expect(option(wrapper, 'url').text()).toBe('已复制')

      await vi.advanceTimersByTimeAsync(1500)

      expect(option(wrapper, 'url').text()).toBe('链接')
      vi.useRealTimers()
    })

    it('剪贴板写入被拒绝时给出可见失败反馈', async () => {
      stubClipboard(async () => {
        throw new Error('NotAllowedError')
      })

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link' })
      await expand(wrapper)
      await option(wrapper, 'url').trigger('click')
      await flushPromises()

      expect(option(wrapper, 'url').text()).toBe('失败')
    })

    it('background 取字节失败时也给出失败反馈，而不是复制出半截内容', async () => {
      stubClipboard()
      vi.mocked(sendMessage).mockResolvedValue({ success: false, error: 'HTTP 404' } as never)

      const wrapper = mountCard({ url: 'https://example.com/a.png', source: 'link', mimeType: 'image/png' })
      await expand(wrapper)
      await option(wrapper, 'data-uri').trigger('click')
      await flushPromises()

      expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
      expect(option(wrapper, 'data-uri').text()).toBe('失败')
    })
  })
})

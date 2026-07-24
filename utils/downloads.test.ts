import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { downloadIconFile } from './downloads'

describe('downloadIconFile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('下载成功时返回 downloadId', async () => {
    const spy = vi.spyOn(fakeBrowser.downloads, 'download').mockResolvedValue(42)

    const result = await downloadIconFile('https://example.com/favicon.ico', 'example.com-favicon.ico')

    expect(spy).toHaveBeenCalledWith({
      url: 'https://example.com/favicon.ico',
      filename: 'example.com-favicon.ico',
    })
    expect(result).toEqual({ success: true, downloadId: 42 })
  })

  it('下载抛错时返回 success:false 与错误字符串', async () => {
    vi.spyOn(fakeBrowser.downloads, 'download').mockRejectedValue(new Error('user canceled'))

    const result = await downloadIconFile('https://example.com/favicon.ico', 'f.ico')

    expect(result).toEqual({ success: false, error: 'Error: user canceled' })
  })
})

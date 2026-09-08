import { downloadIconFile } from '@/utils/downloads'
import { fetchIconBytes } from '@/utils/icon-bytes'
import { discoverIcons } from '@/utils/icon-discovery'
import { onMessage } from '@/utils/messaging'

export default defineBackground(() => {
  onMessage('scanIcons', async ({ data }) => {
    try {
      const tab = await browser.tabs.get(data.tabId)
      return await discoverIcons(tab)
    }
    catch {
      // tab 在扫描间隙被关闭/失效：降级为受限结果，避免异常透传给 popup
      return { restricted: true, candidates: [] }
    }
  })

  onMessage('downloadIcon', ({ data }) => downloadIconFile(data.url, data.filename))

  // popup 里 fetch 跨域图标会被 CORS 拦，取字节这一步必须落在 background
  onMessage('fetchIconBytes', ({ data }) => fetchIconBytes(data.url))
})

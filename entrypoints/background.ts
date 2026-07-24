import { downloadIconFile } from '@/utils/downloads'
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
})

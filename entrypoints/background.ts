import { downloadIconFile } from '@/utils/downloads'
import { discoverIcons } from '@/utils/icon-discovery'
import { onMessage } from '@/utils/messaging'

export default defineBackground(() => {
  onMessage('scanIcons', async ({ data }) => {
    const tab = await browser.tabs.get(data.tabId)
    return discoverIcons(tab)
  })

  onMessage('downloadIcon', ({ data }) => downloadIconFile(data.url, data.filename))
})

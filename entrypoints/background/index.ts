import { downloadIconFile } from '@/utils/downloads'
import { fetchIconBytes } from '@/utils/icon-bytes'
import { discoverIcons } from '@/utils/icon-discovery'
import { buildZipFilename } from '@/utils/icon-naming'
import { buildIconZipDataUrl } from '@/utils/icon-zip'
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

  /*
   * 打包整包也落在 background：一条消息发出去之后 popup 关不关都不影响，
   * 取字节、zipSync、发起下载全在这里跑完。
   */
  onMessage('downloadIconsZip', async ({ data }) => {
    const zip = await buildIconZipDataUrl(data.candidates, data.domain)
    if (!zip.success || !zip.dataUrl)
      return { success: false, error: zip.error }

    const download = await downloadIconFile(zip.dataUrl, buildZipFilename(data.domain))
    return { ...download, packed: zip.packed, skipped: zip.skipped }
  })
})

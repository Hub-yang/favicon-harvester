import type { DownloadResult } from './types'

export async function downloadIconFile(url: string, filename: string): Promise<DownloadResult> {
  try {
    const downloadId = await browser.downloads.download({ url, filename })
    return { success: true, downloadId }
  }
  catch (error) {
    return { success: false, error: String(error) }
  }
}

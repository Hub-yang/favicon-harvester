import type { DownloadResult, ScanResult } from './types'
import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
  scanIcons: (data: { tabId: number }) => ScanResult
  downloadIcon: (data: { url: string, filename: string }) => DownloadResult
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()

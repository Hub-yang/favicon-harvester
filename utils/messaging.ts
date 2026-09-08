import type { DownloadResult, IconBytesResult, ScanResult } from './types'
import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
  scanIcons: (data: { tabId: number }) => ScanResult
  downloadIcon: (data: { url: string, filename: string }) => DownloadResult
  fetchIconBytes: (data: { url: string }) => IconBytesResult
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()

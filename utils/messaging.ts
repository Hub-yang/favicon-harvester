import type { DownloadResult, IconBytesResult, IconCandidate, ScanResult, ZipDownloadResult } from './types'
import { defineExtensionMessaging } from '@webext-core/messaging'

interface ProtocolMap {
  scanIcons: (data: { tabId: number }) => ScanResult
  downloadIcon: (data: { url: string, filename: string }) => DownloadResult
  fetchIconBytes: (data: { url: string }) => IconBytesResult
  downloadIconsZip: (data: { candidates: IconCandidate[], domain: string }) => ZipDownloadResult
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()

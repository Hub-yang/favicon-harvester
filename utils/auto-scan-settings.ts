export const AUTO_SCAN_ENABLED_KEY = 'autoScanEnabled'
export const AUTO_SCAN_HOST_PATTERNS = ['http://*/*', 'https://*/*'] as const

export async function readAutoScanEnabled() {
  const settings = await browser.storage.local.get(AUTO_SCAN_ENABLED_KEY)
  return settings[AUTO_SCAN_ENABLED_KEY] === true
}

export async function readAutoScanOrigins() {
  const { origins = [] } = await browser.permissions.getAll()
  return origins.filter(origin => origin.startsWith('http://') || origin.startsWith('https://'))
}

export function writeAutoScanEnabled(enabled: boolean) {
  return browser.storage.local.set({ [AUTO_SCAN_ENABLED_KEY]: enabled })
}

const RESTRICTED_PREFIXES = [
  'chrome://',
  'edge://',
  'about:',
  'chrome-extension://',
  'moz-extension://',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
  'https://microsoftedge.microsoft.com/addons',
]

export function checkRestrictedUrl(url: string): boolean {
  return RESTRICTED_PREFIXES.some(prefix => url.startsWith(prefix))
}

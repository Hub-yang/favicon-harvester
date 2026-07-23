import { describe, expect, it } from 'vitest'
import { checkRestrictedUrl } from './restricted-pages'

describe('checkRestrictedUrl', () => {
  it.each([
    'chrome://extensions',
    'chrome://newtab/',
    'edge://settings',
    'about:blank',
    'chrome-extension://abcdefghijklmnop/options.html',
    'moz-extension://abcdefghijklmnop/options.html',
    'https://chrome.google.com/webstore/detail/xxx',
    'https://chromewebstore.google.com/detail/xxx',
    'https://microsoftedge.microsoft.com/addons/detail/xxx',
  ])('命中受限前缀: %s', (url) => {
    expect(checkRestrictedUrl(url)).toBe(true)
  })

  it.each([
    'https://github.com',
    'https://example.com/chrome://not-a-real-prefix',
    'http://localhost:3000',
    'file:///Users/me/test.pdf',
  ])('不命中受限前缀: %s', (url) => {
    expect(checkRestrictedUrl(url)).toBe(false)
  })

  it('空字符串不崩溃，且不判定为受限', () => {
    expect(checkRestrictedUrl('')).toBe(false)
  })
})

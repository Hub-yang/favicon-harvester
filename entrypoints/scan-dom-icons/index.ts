import type { DomScanResult } from '@/utils/types'

/**
 * 通过 `browser.scripting.executeScript({ files: [...] })` 注入到目标页面独立执行，
 * 不能依赖 background 闭包变量/运行时状态；只读当前页面 DOM，不做任何网络请求。
 */

// rel 是空格分隔的多值属性：`alternate icon`、`shortcut icon` 都靠其中的 `icon` 命中，
// 所以按单个值比对，`shortcut icon` 不再单列
const ICON_REL_TOKENS = new Set([
  'icon',
  'apple-touch-icon',
  'apple-touch-icon-precomposed',
  'mask-icon',
])

export function scanDomIcons(doc: Document): DomScanResult {
  const icons: DomScanResult['icons'] = []
  let manifestHref: string | undefined

  doc.querySelectorAll<HTMLLinkElement>('link[rel]').forEach((link) => {
    const tokens = link.rel.toLowerCase().split(/\s+/).filter(Boolean)

    if (tokens.some(token => ICON_REL_TOKENS.has(token))) {
      const href = link.href
      if (!href)
        return
      icons.push({
        href,
        rel: tokens.join(' '),
        sizes: link.getAttribute('sizes') ?? undefined,
      })
      return
    }

    if (tokens.includes('manifest') && manifestHref === undefined) {
      manifestHref = link.href || undefined
    }
  })

  return { icons, manifestHref }
}

export default defineUnlistedScript(() => scanDomIcons(document))

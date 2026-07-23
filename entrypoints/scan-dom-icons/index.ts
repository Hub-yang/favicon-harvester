import type { DomScanResult } from '@/utils/types'

/**
 * 通过 `browser.scripting.executeScript({ files: [...] })` 注入到目标页面独立执行，
 * 不能依赖 background 闭包变量/运行时状态；只读当前页面 DOM，不做任何网络请求。
 */

const ICON_RELS = new Set([
  'icon',
  'shortcut icon',
  'apple-touch-icon',
  'apple-touch-icon-precomposed',
  'mask-icon',
])

export function scanDomIcons(doc: Document): DomScanResult {
  const icons: DomScanResult['icons'] = []
  let manifestHref: string | undefined

  doc.querySelectorAll<HTMLLinkElement>('link[rel]').forEach((link) => {
    const rel = link.rel.trim().toLowerCase()

    if (ICON_RELS.has(rel)) {
      const href = link.href
      if (!href)
        return
      icons.push({
        href,
        rel,
        sizes: link.getAttribute('sizes') ?? undefined,
      })
      return
    }

    if (rel === 'manifest' && manifestHref === undefined) {
      manifestHref = link.href || undefined
    }
  })

  return { icons, manifestHref }
}

export default defineUnlistedScript(() => scanDomIcons(document))

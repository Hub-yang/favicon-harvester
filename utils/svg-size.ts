export interface SvgSize {
  width: number
  height: number
}

function parseLength(raw: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?|\.\d+)(?:px)?$/i.exec(raw.trim())
  if (!match)
    return undefined

  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function extractLength(tag: string, attr: 'width' | 'height'): number | undefined {
  const match = new RegExp(`(?<![\\w-])${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  const raw = match?.[1] ?? match?.[2]
  return raw === undefined ? undefined : parseLength(raw)
}

function parseViewBoxSize(tag: string): SvgSize | undefined {
  const match = /viewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)
  const value = match?.[1] ?? match?.[2]
  if (!value)
    return undefined

  const parts = value.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n)))
    return undefined

  const [, , width, height] = parts as [number, number, number, number]
  return width > 0 && height > 0 ? { width, height } : undefined
}

/**
 * 纯文本正则解析 SVG 根标签尺寸，不能用 DOMParser——
 * 该函数最终会在无 document 的 service worker（background.ts）里被调用。
 */
export function parseSvgSize(svgText: string): SvgSize | undefined {
  const rootMatch = /<svg\b[^>]*>/i.exec(svgText)
  if (!rootMatch)
    return undefined

  const tag = rootMatch[0]
  const width = extractLength(tag, 'width')
  const height = extractLength(tag, 'height')
  if (width !== undefined && height !== undefined)
    return { width, height }

  return parseViewBoxSize(tag)
}

export interface ParsedSizes {
  width: number
  height: number
}

/** 解析 <link sizes> / manifest icons[].sizes 形如 "180x180" 或多值空格分隔字符串，取第一个 */
export function parseSizesAttribute(sizes: string | undefined): ParsedSizes | undefined {
  if (!sizes)
    return undefined

  const first = sizes.trim().split(/\s+/)[0]
  const match = /^(\d+)x(\d+)$/i.exec(first ?? '')
  if (!match)
    return undefined

  return { width: Number(match[1]), height: Number(match[2]) }
}

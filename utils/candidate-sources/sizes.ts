import type { Size } from '../types'

/**
 * 解析 <link sizes> / manifest icons[].sizes，形如 "180x180" 或多值空格分隔字符串。
 * 全部合法值都保留：多帧 ICO 常写成 "16x16 32x32 48x48"，只取第一个会让声明与实测的比对误报。
 * "any" 与写错的值逐个跳过，不连累同一串里的合法值。
 */
export function parseSizesAttribute(sizes: string | undefined): Size[] {
  if (!sizes)
    return []

  return sizes.trim().split(/\s+/).flatMap((token) => {
    const match = /^(\d+)x(\d+)$/i.exec(token)
    return match ? [{ width: Number(match[1]), height: Number(match[2]) }] : []
  })
}

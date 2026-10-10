import type { IconCandidate, Size } from './types'
import { resolveIconExtension } from './icon-naming'

export interface SizeMismatch {
  declared: Size[]
  actual: Size
}

/**
 * 页面声明的尺寸与实测尺寸对不上时返回两者，否则返回 undefined。
 * 实测失败时 width/height 退回的正是第一个声明值，天然命中声明列表，不会误报。
 * SVG 复用 resolveIconExtension 判定，与排序、格式标签、文件名三处同源。
 */
export function findSizeMismatch(candidate: IconCandidate): SizeMismatch | undefined {
  const { width, height, declaredSizes } = candidate
  if (width === undefined || height === undefined || !declaredSizes?.length)
    return undefined
  if (resolveIconExtension(candidate) === 'svg')
    return undefined
  if (declaredSizes.some(size => size.width === width && size.height === height))
    return undefined

  return { declared: declaredSizes, actual: { width, height } }
}

import type { IconCandidate } from './types'
import { resolveIconExtension } from './icon-naming'

/** SVG 是矢量图，可缩放到任意尺寸，排序上视为最大，不参与位图之间的面积比较 */
const VECTOR_RANK = Number.POSITIVE_INFINITY
/** 尺寸未知的候选无从比较大小，统一垫底 */
const UNKNOWN_RANK = -1

// 复用 resolveIconExtension 判定 SVG，保证与卡片展示的格式标签、下载文件名扩展名三处同源
function sizeRank(candidate: IconCandidate): number {
  if (resolveIconExtension(candidate) === 'svg')
    return VECTOR_RANK

  if (candidate.width !== undefined && candidate.height !== undefined)
    return candidate.width * candidate.height

  return UNKNOWN_RANK
}

/**
 * 按尺寸降序排列候选：SVG 最前，其次按面积从大到小，尺寸未知的垫底。
 * 同级返回 0 以借助 Array.sort 的稳定性保持原发现顺序（两个 VECTOR_RANK 相减会得到 NaN，必须先判等）。
 */
export function sortCandidatesBySize(candidates: IconCandidate[]): IconCandidate[] {
  return [...candidates].sort((a, b) => {
    const rankA = sizeRank(a)
    const rankB = sizeRank(b)
    return rankA === rankB ? 0 : rankB - rankA
  })
}

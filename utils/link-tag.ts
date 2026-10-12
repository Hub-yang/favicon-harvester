import type { IconCandidate } from './types'

/** 页面上常见的 apple-touch-icon 系列，well-known 路径按文件名前缀识别 */
const APPLE_TOUCH_ICON_REL = 'apple-touch-icon'

function resolveRel(candidate: IconCandidate): string {
  // 来自页面 <link> 的候选，sourceDetail 就是原始 rel，原样复用最准
  if (candidate.source === 'link' && candidate.sourceDetail)
    return candidate.sourceDetail

  if (candidate.sourceDetail?.includes(APPLE_TOUCH_ICON_REL))
    return APPLE_TOUCH_ICON_REL

  return 'icon'
}

function escapeAttribute(value: string): string {
  return value.replaceAll('"', '&quot;')
}

/**
 * 拼出可直接粘进 <head> 的 link 标签。
 * type / sizes 只在确实拿到值时输出——写个空属性反而会误导抄走的人。
 */
export function buildLinkTag(candidate: IconCandidate): string {
  const attributes = [`rel="${escapeAttribute(resolveRel(candidate))}"`]

  if (candidate.mimeType)
    attributes.push(`type="${escapeAttribute(candidate.mimeType)}"`)

  // 多帧 ICO 的实测值只是最大帧，sizes 本就允许空格分隔多个尺寸，写全才不会把小帧藏掉
  const sizes = candidate.frameSizes
    ?? (candidate.width !== undefined && candidate.height !== undefined ? [{ width: candidate.width, height: candidate.height }] : [])
  if (sizes.length > 0)
    attributes.push(`sizes="${sizes.map(({ width, height }) => `${width}x${height}`).join(' ')}"`)

  attributes.push(`href="${escapeAttribute(candidate.url)}"`)

  return `<link ${attributes.join(' ')}>`
}

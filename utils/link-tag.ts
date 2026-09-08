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

  if (candidate.width !== undefined && candidate.height !== undefined)
    attributes.push(`sizes="${candidate.width}x${candidate.height}"`)

  attributes.push(`href="${escapeAttribute(candidate.url)}"`)

  return `<link ${attributes.join(' ')}>`
}

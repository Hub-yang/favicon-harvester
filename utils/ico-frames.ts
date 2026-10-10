import type { Size } from './types'

const HEADER_BYTES = 6
const ENTRY_BYTES = 16
/** ICO 文件头的类型字段：1 为图标，2 为光标（.cur） */
const ICON_TYPE = 1
/** 目录项宽高只占一个字节，写 0 表示 256 */
const ZERO_MEANS = 256

/**
 * 只读 ICO 目录，列出文件里每一帧的尺寸。
 * 只看目录、不解码帧数据：拿到「里面有哪些尺寸」就够用，也不触碰「不做格式转换」的约束。
 * 文件头不像 ICO（被截断、是光标、其实是 PNG）时返回 undefined，调用方据此不展示帧信息。
 */
export function parseIcoFrameSizes(bytes: Uint8Array): Size[] | undefined {
  if (bytes.length < HEADER_BYTES)
    return undefined

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = view.getUint16(4, true)
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== ICON_TYPE || count === 0)
    return undefined
  if (bytes.length < HEADER_BYTES + ENTRY_BYTES * count)
    return undefined

  // 同尺寸不同色深的帧在用户眼里是同一个尺寸，按宽高去重
  const sizes = new Map<string, Size>()
  for (let index = 0; index < count; index++) {
    const offset = HEADER_BYTES + ENTRY_BYTES * index
    const width = view.getUint8(offset) || ZERO_MEANS
    const height = view.getUint8(offset + 1) || ZERO_MEANS
    sizes.set(`${width}x${height}`, { width, height })
  }

  return [...sizes.values()].sort((a, b) => a.width * a.height - b.width * b.height)
}

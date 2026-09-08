/**
 * 一次传给 String.fromCharCode 的最大字节数。
 * 展开运算符会把每个字节变成一个实参，十万级长度会直接抛 RangeError，因此必须分块。
 */
const CHUNK_SIZE = 8192

/** 图标字节 → base64。background 取到 arrayBuffer 后用它跨消息通道传给 popup。 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK_SIZE))

  return btoa(binary)
}

/** base64 → 字节。ZIP 打包需要直接拿到 Uint8Array，不经过 Blob 中转。 */
export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1)
    bytes[i] = binary.charCodeAt(i)

  return bytes
}

/** base64 → Blob。popup 侧写剪贴板（ClipboardItem）需要真正的 Blob。 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  return new Blob([base64ToBytes(base64)], { type: mimeType })
}

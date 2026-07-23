const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47]
const ICO_SIGNATURE = [0x00, 0x00, 0x01, 0x00]
const JPEG_SIGNATURE = [0xFF, 0xD8, 0xFF]
const GIF_SIGNATURES = ['GIF87a', 'GIF89a']

function matchesBytes(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return bytes.length >= offset + signature.length
    && signature.every((byte, index) => bytes[offset + index] === byte)
}

function matchesAscii(bytes: Uint8Array, text: string, offset = 0): boolean {
  if (bytes.length < offset + text.length)
    return false

  return [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0))
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 512))
  return /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(text)
}

/** 仅在响应头缺失或为 application/octet-stream 时由调用方触发的兜底嗅探 */
export function sniffMimeFromBytes(bytes: Uint8Array): string | undefined {
  if (matchesBytes(bytes, PNG_SIGNATURE))
    return 'image/png'
  if (matchesBytes(bytes, ICO_SIGNATURE))
    return 'image/x-icon'
  if (matchesBytes(bytes, JPEG_SIGNATURE))
    return 'image/jpeg'
  if (GIF_SIGNATURES.some(signature => matchesAscii(bytes, signature)))
    return 'image/gif'
  if (matchesAscii(bytes, 'RIFF') && matchesAscii(bytes, 'WEBP', 8))
    return 'image/webp'
  if (looksLikeSvg(bytes))
    return 'image/svg+xml'

  return undefined
}

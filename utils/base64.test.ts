import { describe, expect, it } from 'vitest'
import { base64ToBlob, bytesToBase64 } from './base64'

describe('base64', () => {
  it('字节与 base64 之间往返转换后内容不变', async () => {
    const original = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0xFF, 0x7F])

    const blob = base64ToBlob(bytesToBase64(original), 'image/png')

    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(original)
    expect(blob.type).toBe('image/png')
  })

  it('空字节序列转出空串，再转回空 Blob', async () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('')
    expect((await base64ToBlob('', 'image/png').arrayBuffer()).byteLength).toBe(0)
  })

  it('大图标不会因为一次性展开参数而爆栈', () => {
    // String.fromCharCode(...bytes) 在十万级长度上会抛 RangeError，必须分块处理
    const large = new Uint8Array(300_000).fill(0x41)

    expect(() => bytesToBase64(large)).not.toThrow()
    expect(bytesToBase64(large)).toBe(btoa('A'.repeat(300_000)))
  })
})

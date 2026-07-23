import { describe, expect, it } from 'vitest'
import { sniffMimeFromBytes } from './mime-sniff'

function bytesFrom(numbers: number[]): Uint8Array {
  return Uint8Array.from(numbers)
}

function bytesFromText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('sniffMimeFromBytes', () => {
  it('识别 PNG', () => {
    expect(sniffMimeFromBytes(bytesFrom([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))).toBe('image/png')
  })

  it('识别 ICO', () => {
    expect(sniffMimeFromBytes(bytesFrom([0x00, 0x00, 0x01, 0x00, 0x01, 0x00]))).toBe('image/x-icon')
  })

  it('识别 JPEG', () => {
    expect(sniffMimeFromBytes(bytesFrom([0xFF, 0xD8, 0xFF, 0xE0]))).toBe('image/jpeg')
  })

  it('识别 GIF87a', () => {
    expect(sniffMimeFromBytes(bytesFromText('GIF87a'))).toBe('image/gif')
  })

  it('识别 GIF89a', () => {
    expect(sniffMimeFromBytes(bytesFromText('GIF89a'))).toBe('image/gif')
  })

  it('识别 WEBP', () => {
    const bytes = bytesFrom([
      ...bytesFromText('RIFF'),
      0x00,
      0x00,
      0x00,
      0x00,
      ...bytesFromText('WEBP'),
    ])
    expect(sniffMimeFromBytes(bytes)).toBe('image/webp')
  })

  it('识别 SVG 文本', () => {
    expect(sniffMimeFromBytes(bytesFromText('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe('image/svg+xml')
  })

  it('svg 前有 XML 声明与注释也能识别', () => {
    const text = '<?xml version="1.0"?>\n<!-- comment -->\n<svg></svg>'
    expect(sniffMimeFromBytes(bytesFromText(text))).toBe('image/svg+xml')
  })

  it('无法识别的字节序列返回 undefined', () => {
    expect(sniffMimeFromBytes(bytesFrom([0x01, 0x02, 0x03, 0x04]))).toBeUndefined()
  })

  it('空字节数组返回 undefined', () => {
    expect(sniffMimeFromBytes(bytesFrom([]))).toBeUndefined()
  })
})

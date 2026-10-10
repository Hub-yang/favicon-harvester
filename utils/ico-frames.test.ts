import { describe, expect, it } from 'vitest'
import { parseIcoFrameSizes } from './ico-frames'

/** 只造文件头 + 目录：解析器只读目录，帧数据不需要真实存在 */
function icoBytes(frames: [number, number][], options: { type?: number, reserved?: number, dropTail?: number } = {}): Uint8Array {
  const { type = 1, reserved = 0, dropTail = 0 } = options
  const bytes = new Uint8Array(6 + 16 * frames.length)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, reserved, true)
  view.setUint16(2, type, true)
  view.setUint16(4, frames.length, true)
  frames.forEach(([width, height], index) => {
    bytes[6 + 16 * index] = width
    bytes[6 + 16 * index + 1] = height
  })
  return bytes.subarray(0, bytes.length - dropTail)
}

describe('parseIcoFrameSizes', () => {
  it('读出每一帧的尺寸，按面积从小到大排', () => {
    expect(parseIcoFrameSizes(icoBytes([[48, 48], [16, 16], [32, 32]]))).toEqual([
      { width: 16, height: 16 },
      { width: 32, height: 32 },
      { width: 48, height: 48 },
    ])
  })

  it('宽高字节为 0 表示 256', () => {
    expect(parseIcoFrameSizes(icoBytes([[0, 0], [16, 16]]))).toEqual([
      { width: 16, height: 16 },
      { width: 256, height: 256 },
    ])
  })

  it('同一尺寸的多个帧（不同色深）只算一次', () => {
    expect(parseIcoFrameSizes(icoBytes([[16, 16], [16, 16], [32, 32]]))).toEqual([
      { width: 16, height: 16 },
      { width: 32, height: 32 },
    ])
  })

  it('保留非正方形帧的宽高', () => {
    expect(parseIcoFrameSizes(icoBytes([[16, 12]]))).toEqual([{ width: 16, height: 12 }])
  })

  it('目录被截断时返回 undefined', () => {
    expect(parseIcoFrameSizes(icoBytes([[16, 16], [32, 32]], { dropTail: 1 }))).toBeUndefined()
    expect(parseIcoFrameSizes(new Uint8Array([0, 0, 1]))).toBeUndefined()
  })

  it('类型不是 1（如光标文件的 2）时返回 undefined', () => {
    expect(parseIcoFrameSizes(icoBytes([[32, 32]], { type: 2 }))).toBeUndefined()
  })

  it('保留字段不为 0 时返回 undefined', () => {
    expect(parseIcoFrameSizes(icoBytes([[32, 32]], { reserved: 1 }))).toBeUndefined()
  })

  it('帧数为 0 时返回 undefined', () => {
    expect(parseIcoFrameSizes(icoBytes([]))).toBeUndefined()
  })

  it('响应头说是 ICO、字节其实是 PNG 时返回 undefined', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(parseIcoFrameSizes(png)).toBeUndefined()
  })
})

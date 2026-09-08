import { describe, expect, it } from 'vitest'
import { dedupeEntryNames } from './zip-entry-name'

describe('dedupeEntryNames', () => {
  it('没有重名时原样返回', () => {
    expect(dedupeEntryNames(['a.png', 'b.svg'])).toEqual(['a.png', 'b.svg'])
  })

  it('重名项从第二个开始加序号后缀，且插在扩展名之前', () => {
    expect(dedupeEntryNames(['a.png', 'a.png', 'a.png'])).toEqual(['a.png', 'a-2.png', 'a-3.png'])
  })

  it('消解出的名字若撞上列表里已有的名字则继续递增', () => {
    expect(dedupeEntryNames(['a.png', 'a-2.png', 'a.png'])).toEqual(['a.png', 'a-2.png', 'a-3.png'])
  })

  it('没有扩展名的名字把后缀加在末尾', () => {
    expect(dedupeEntryNames(['icon', 'icon'])).toEqual(['icon', 'icon-2'])
  })

  it('只认最后一个点作为扩展名分隔，多点文件名不会被切错', () => {
    expect(dedupeEntryNames(['a.b.png', 'a.b.png'])).toEqual(['a.b.png', 'a.b-2.png'])
  })

  it('空列表返回空列表', () => {
    expect(dedupeEntryNames([])).toEqual([])
  })
})

import { parseMessagesFile } from '@wxt-dev/i18n/build'
import { describe, expect, it } from 'vitest'

/**
 * 中英两份文案必须逐 key 对齐。
 * 后续每加一个功能都要补两份文案，漏翻一条在界面上表现为空字符串，
 * 靠人眼很难发现，因此用测试兜住。
 */
async function loadKeys(locale: string) {
  const messages = await parseMessagesFile(`locales/${locale}.yml`)
  return new Map(messages.map(m => [m.key.join('.'), m]))
}

describe('locales', () => {
  it('zh_CN 与 en 的 key 集合完全一致', async () => {
    const zh = await loadKeys('zh_CN')
    const en = await loadKeys('en')

    expect([...en.keys()].sort()).toEqual([...zh.keys()].sort())
  })

  it('同一 key 的占位符个数在两种语言里一致', async () => {
    const zh = await loadKeys('zh_CN')
    const en = await loadKeys('en')

    const mismatched = [...zh.entries()]
      .filter(([key, message]) => en.get(key)?.substitutions !== message.substitutions)
      .map(([key]) => key)

    expect(mismatched).toEqual([])
  })
})

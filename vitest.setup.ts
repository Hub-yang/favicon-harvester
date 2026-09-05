import { readFileSync } from 'node:fs'
import { generateChromeMessages, parseMessagesText } from '@wxt-dev/i18n/build'
import { fakeBrowser } from 'wxt/testing/fake-browser'

/**
 * fakeBrowser 没有实现 i18n.getMessage，调用会直接抛 "not implemented"。
 * 这里用 locales/zh_CN.yml 的真实文案补上，好处是组件测试断言到的仍然是用户实际看到的中文，
 * 而不是 i18n 的 key —— 占位符拼错、漏翻这类问题才能被现有断言接住。
 *
 * 直接赋值而非 vi.spyOn：多个测试文件在 afterEach 里调 vi.restoreAllMocks()，spy 会被一并还原。
 */
const messages = generateChromeMessages(
  parseMessagesText(readFileSync('locales/zh_CN.yml', 'utf-8'), 'YAML'),
)

function getMessage(key: string, substitutions?: string | string[]): string {
  const message = messages[key]?.message
  if (message === undefined)
    return ''

  const values = Array.isArray(substitutions) ? substitutions : [substitutions ?? '']
  // 复数的 " | " 分隔交给 i18n.t 自己拆，这里只负责 $N 占位符替换
  return message.replace(/\$(\d)/g, (_, index: string) => values[Number(index) - 1] ?? '')
}

fakeBrowser.i18n.getMessage = getMessage as typeof fakeBrowser.i18n.getMessage

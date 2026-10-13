import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss', '@wxt-dev/auto-icons', '@wxt-dev/i18n/module'],
  manifest: {
    // 文案取自 locales/*.yml；default_locale 决定未命中语言时回退到哪一份
    default_locale: 'zh_CN',
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    permissions: ['activeTab', 'scripting', 'downloads', 'contextMenus'],
    // _execute_action 不派发 commands.onCommand，按键直接打开面板，background 不用写代码
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+F' },
      },
    },
  },
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
})

import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue', '@wxt-dev/unocss', '@wxt-dev/auto-icons'],
  manifest: {
    permissions: ['activeTab', 'scripting', 'downloads'],
  },
  autoIcons: {
    baseIconPath: 'assets/icon.svg',
  },
})

import { createApp } from 'vue'
import { i18n } from '#i18n'
import App from './App.vue'
import 'virtual:uno.css'

document.documentElement.lang = browser.i18n.getUILanguage()
document.title = i18n.t('autoScan.title')
createApp(App).mount('#app')

import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import 'virtual:uno.css'

// index.html 里的 lang 是静态占位，这里按浏览器实际 UI 语言回填，避免英文界面下走中文字形渲染
document.documentElement.lang = browser.i18n.getUILanguage()

createApp(App).mount('#app')

import { defineConfig, presetIcons, presetWind3 } from 'unocss'

// presetWind3：Tailwind 兼容的原子类 preset（presetUno 的正式后继）。
// 不加 preset 时 UnoCSS 不产出任何工具类，故 popup UI 依赖它。
// presetIcons：图标在构建期从本地 @iconify-json 包内联进 CSS，运行时不发任何网络请求。
export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({
      extraProperties: {
        'display': 'inline-block',
        'flex-shrink': '0',
      },
    }),
  ],
})

import { defineConfig, presetWind3 } from 'unocss'

// presetWind3：Tailwind 兼容的原子类 preset（presetUno 的正式后继）。
// 不加 preset 时 UnoCSS 不产出任何工具类，故 popup UI 依赖它。
export default defineConfig({
  presets: [presetWind3()],
})

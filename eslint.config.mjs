import antfu from '@antfu/eslint-config'
import autoImports from './.wxt/eslint-auto-imports.mjs'

export default antfu({
  vue: true,
  typescript: true,
}).append(autoImports)

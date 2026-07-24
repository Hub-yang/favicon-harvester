import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
  // vue 插件用于编译 .vue 单文件组件（WxtVitest 不含 SFC 处理）
  plugins: [vue(), WxtVitest()],
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // 只统计业务逻辑与组件（限定 .ts/.vue，避免 html/css 被误当 JS 插桩报错）
      include: ['utils/**/*.ts', 'entrypoints/**/*.{ts,vue}'],
      exclude: [
        '**/*.test.ts',
        'utils/types.ts', // 纯类型声明，无运行时代码
        'utils/messaging.ts', // 消息协议定义，无独立逻辑
        'entrypoints/popup/main.ts', // Vue 挂载入口壳
        '**/*.config.*',
      ],
      // 回归护栏：低于当前实测值（stmts≈97/branch≈93/funcs≈95/lines≈97）留足余量，
      // 仅作用于 test:coverage，不影响 pre-commit（后者只跑 eslint + vue-tsc）
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 85,
        lines: 90,
      },
    },
  },
})

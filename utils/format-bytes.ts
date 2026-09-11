const KB = 1024
const UNITS = ['B', 'KB', 'MB'] as const

/**
 * 数值部分的显示规则：小于 10 保留一位小数（1.2 KB 和 1.9 KB 要能分辨），
 * 大于等于 10 取整（卡片宽度紧张，128 KB 不值得写成 128.4 KB），整数不留 `.0` 尾巴。
 */
function formatValue(value: number): string {
  if (value >= 10)
    return String(Math.round(value))

  return value.toFixed(1).replace(/\.0$/, '')
}

/** 字节数 → 人类可读体积，用于卡片上展示图标文件大小 */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unitIndex = 0
  while (value >= KB && unitIndex < UNITS.length - 1) {
    value /= KB
    unitIndex += 1
  }

  // 字节档不做小数：半个字节没有意义
  return `${unitIndex === 0 ? value : formatValue(value)} ${UNITS[unitIndex]}`
}

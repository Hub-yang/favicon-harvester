/** 拆成 [主干, 扩展名]，扩展名含前导点；没有扩展名时第二项为空串 */
function splitExtension(name: string): [string, string] {
  const dotIndex = name.lastIndexOf('.')
  // 前导点开头的隐藏文件不算扩展名，整串当主干
  if (dotIndex <= 0)
    return [name, '']

  return [name.slice(0, dotIndex), name.slice(dotIndex)]
}

/**
 * 消解 ZIP 条目重名：同名项从第二个起加 `-2`、`-3` 后缀，插在扩展名之前。
 *
 * 单个下载时重名交给 Chrome 自己加 `(1)`，但 ZIP 条目重名会让解压方各行其是
 * （覆盖、静默丢弃、乱码后缀都见过），必须在打包前就消解掉。
 */
export function dedupeEntryNames(names: string[]): string[] {
  const used = new Set<string>()

  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name)
      return name
    }

    const [stem, extension] = splitExtension(name)
    // 从 2 开始递增，直到撞不上任何已用名字——避免与列表里原本就存在的 `a-2.png` 再次冲突
    let suffix = 2
    let candidate = `${stem}-${suffix}${extension}`
    while (used.has(candidate)) {
      suffix += 1
      candidate = `${stem}-${suffix}${extension}`
    }

    used.add(candidate)
    return candidate
  })
}

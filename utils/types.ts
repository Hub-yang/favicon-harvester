/** 图标候选的来源分类 */
export type IconSourceCategory = 'link' | 'manifest' | 'well-known' | 'tab'

/** 一个去重后的图标候选 */
export interface IconCandidate {
  /** 绝对 URL，作为去重 key */
  url: string
  source: IconSourceCategory
  /** 例如 DOM 的 rel 值、well-known 的文件名、manifest icon 的 purpose */
  sourceDetail?: string
  width?: number
  height?: number
  /** probeCandidate 探测后回填，供命名规则推导扩展名 */
  mimeType?: string
}

/** background 扫描流程的最终返回结果 */
export interface ScanResult {
  restricted: boolean
  candidates: IconCandidate[]
}

/** 单个下载请求的结果 */
export interface DownloadResult {
  success: boolean
  downloadId?: number
  error?: string
}

/** scan-dom-icons.ts 注入脚本的返回值 */
export interface DomScanResult {
  icons: {
    /** 取 <link>.href，浏览器已解析为绝对地址 */
    href: string
    rel: string
    /** <link sizes="..."> 原始字符串 */
    sizes?: string
  }[]
  manifestHref?: string
}

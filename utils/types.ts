/** 宽高尺寸（像素） */
export interface Size {
  width: number
  height: number
}

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
  /** probeCandidate 探测时顺手回填的文件字节数，供卡片展示体积 */
  byteLength?: number
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

/** 取图标字节的结果：成功时带 base64 与 MIME，供 popup 拼 Data URI 或写剪贴板 */
export interface IconBytesResult {
  success: boolean
  base64?: string
  mimeType?: string
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

/** 打包 ZIP 的结果：成功时带可直接下载的 data URL，并报告实际打进包里/被跳过的图标数 */
export interface IconZipResult {
  success: boolean
  dataUrl?: string
  /** 实际打进包里的图标数 */
  packed?: number
  /** 取字节失败被跳过的图标数 */
  skipped?: number
  error?: string
}

/** 打包 ZIP 并下载的结果：在下载结果之上带回实际打包/跳过的图标数，供面板提示 */
export interface ZipDownloadResult {
  success: boolean
  downloadId?: number
  packed?: number
  skipped?: number
  error?: string
}

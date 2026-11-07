import Taro from '@tarojs/taro'

export const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined'
export const IS_MINI = !IS_BROWSER

export function storageGet(key: string): string | null {
  if (IS_BROWSER) return window.localStorage.getItem(key)
  const value = Taro.getStorageSync(key)
  return typeof value === 'string' && value ? value : null
}

export function storageSet(key: string, value: string) {
  if (IS_BROWSER) window.localStorage.setItem(key, value)
  else Taro.setStorageSync(key, value)
}

export function storageRemove(key: string) {
  if (IS_BROWSER) window.localStorage.removeItem(key)
  else Taro.removeStorageSync(key)
}

export function scrollToTop() {
  if (IS_BROWSER) window.scrollTo({ top: 0 })
  else void Taro.pageScrollTo({ scrollTop: 0 })
}

export function setPageTitle(title: string) {
  if (IS_BROWSER) document.title = title
  else void Taro.setNavigationBarTitle({ title })
}

export function isSmallScreen() {
  if (IS_BROWSER) return window.matchMedia('(max-width: 639px)').matches
  return Taro.getSystemInfoSync().windowWidth < 640
}

export async function copyText(text: string): Promise<void> {
  if (IS_BROWSER) {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        return
      } catch {
        // HTTP 等环境使用手动复制
      }
    }
    window.prompt('复制以下内容：', text)
  } else await Taro.setClipboardData({ data: text })
}

export async function confirmAction(message: string): Promise<boolean> {
  if (IS_BROWSER) return window.confirm(message)
  const result = await Taro.showModal({ title: '确认操作', content: message })
  return result.confirm
}

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  if (IS_MINI) {
    void Taro.setClipboardData({ data: text })
    return
  }
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function pickBinaryFile(extension: string): Promise<Uint8Array | null> {
  if (IS_BROWSER) {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = `.${extension}`
      input.onchange = () => resolve(input.files?.[0] ?? null)
      input.click()
    })
    return file ? new Uint8Array(await file.arrayBuffer()) : null
  }
  const selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: [extension] })
  const filePath = selected.tempFiles[0]?.path
  if (!filePath) return null
  const data = await new Promise<ArrayBuffer>((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      success: (result) => resolve(result.data as ArrayBuffer),
      fail: reject,
    })
  })
  return new Uint8Array(data)
}

export async function saveBinaryFile(filename: string, data: Uint8Array, mime: string) {
  if (IS_BROWSER) {
    const blob = new Blob([data as BlobPart], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return
  }
  const filePath = `${Taro.env.USER_DATA_PATH ?? '/tmp'}/${filename}`
  await new Promise<void>((resolve, reject) => {
    Taro.getFileSystemManager().writeFile({
      filePath,
      data: Taro.arrayBufferToBase64(data.buffer as ArrayBuffer),
      encoding: 'base64',
      success: () => resolve(),
      fail: reject,
    })
  })
  await Taro.openDocument({ filePath, fileType: 'xlsx', showMenu: true })
}

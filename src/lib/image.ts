import Taro from '@tarojs/taro'
import { IS_BROWSER } from './platform'

/**
 * 图片压缩：上传的图会被裁成固定比例并转成 JPEG data URL，
 * 这样能直接塞进文档里，不依赖对象存储。
 */
export async function readImageAsDataUrl(
  file: File,
  opts: {
    width: number
    height: number
    quality?: number
    /** cover = 居中裁切填满（默认）；stretch = 拉伸铺满，不裁切 */
    fit?: 'cover' | 'stretch'
  } = { width: 220, height: 220 },
): Promise<string> {
  const { width, height, quality = 0.82, fit = 'cover' } = opts
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 不可用')
    ctx.imageSmoothingQuality = 'high'
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, width, height)
    if (fit === 'stretch') {
      // 直接铺满目标框，比例会被改变
      ctx.drawImage(img, 0, 0, width, height)
    } else {
      // 居中裁切到目标比例，避免变形
      const target = width / height
      const src = img.width / img.height
      let sw = img.width
      let sh = img.height
      if (src > target) sw = img.height * target
      else sh = img.width / target
      const sx = (img.width - sw) / 2
      const sy = (img.height - sh) / 2
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
    }
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片读取失败'))
    img.src = url
  })
}

export const AVATAR_SIZE = 220
export const COVER_SIZE = { width: 480, height: 640 }

export async function pickImage(options: {
  width: number
  height: number
  fit?: 'cover' | 'stretch'
}): Promise<string | null> {
  if (IS_BROWSER) {
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = () => resolve(input.files?.[0] ?? null)
      input.click()
    })
    return file ? readImageAsDataUrl(file, options) : null
  }

  const selected = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
  let filePath = selected.tempFiles[0]?.path
  if (!filePath) return null
  try {
    const compressed = await Taro.compressImage({ src: filePath, quality: 82 })
    filePath = compressed.tempFilePath
  } catch {
    // 保留平台不支持压缩时的原图
  }
  const data = await new Promise<string>((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (result) => resolve(String(result.data)),
      fail: reject,
    })
  })
  return `data:image/jpeg;base64,${data}`
}

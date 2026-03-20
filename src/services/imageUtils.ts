/**
 * 图片处理工具
 * - extractDominantColor: 从图片中提取主色调（自适应色彩引擎）
 * - adaptiveColorEngine: 自适应色彩引擎（深色/喜庆红豁免莫兰迪降色）
 * - trimWhiteBorder: 后处理自动裁边（裁切纯色边框）
 * - rotateImage90: 顺时针旋转 90°
 * - compressBase64: Base64 图片压缩
 */

/** 从 base64 图片中提取主色调（使用自适应色彩引擎） */
export async function extractDominantColor(
  base64: string
): Promise<{ hex: string; name: string; rgb: { r: number; g: number; b: number }, colorTemperature?: 'cool' | 'warm' | 'neutral', bypassed?: boolean, bypassReason?: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      // 缩放到小尺寸加速分析
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size).data;
      let totalR = 0, totalG = 0, totalB = 0;
      let count = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];
        // 跳过透明和极端像素
        if (a < 128) continue;
        if (r + g + b < 30 || r + g + b > 735) continue;
        totalR += r;
        totalG += g;
        totalB += b;
        count++;
      }

      if (count === 0) {
        resolve({ hex: '#FFFFFF', name: 'white', rgb: { r: 255, g: 255, b: 255 } });
        return;
      }

      const avgR = Math.round(totalR / count);
      const avgG = Math.round(totalG / count);
      const avgB = Math.round(totalB / count);

      // 🔑 使用自适应色彩引擎替代全局莫兰迪降色
      const result = adaptiveColorEngine(avgR, avgG, avgB);
      resolve(result);
    };
    img.onerror = () => {
      resolve({ hex: '#FFFFFF', name: 'white', rgb: { r: 255, g: 255, b: 255 }, colorTemperature: 'neutral' });
    };
    img.src = `data:image/png;base64,${base64}`;
  });
}

/** 简单的颜色名称识别 */
function getColorName(r: number, g: number, b: number): string {
  const hsl = rgbToHsl(r, g, b);
  const [h, s, l] = hsl;

  if (l < 15) return 'black';
  if (l > 90 && s < 15) return 'white';
  if (s < 12) return l > 60 ? 'light gray' : 'gray';

  if (h < 15 || h >= 345) return s > 50 ? 'red' : 'pink';
  if (h < 45) return l > 60 ? 'peach' : 'orange';
  if (h < 65) return l > 60 ? 'cream' : 'gold';
  if (h < 150) return l > 60 ? 'light green' : 'green';
  if (h < 210) return l > 60 ? 'light blue' : 'teal';
  if (h < 270) return l > 60 ? 'sky blue' : 'blue';
  if (h < 330) return l > 60 ? 'lavender' : 'purple';
  return 'magenta';
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** HSL 转 RGB */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
}

/** 根据色相和饱和度判断冷暖色调 */
export function getColorTemperature(h: number, s: number): 'cool' | 'warm' | 'neutral' {
  if (s < 10) return 'neutral'; // 极低饱和度如黑白灰
  // 暖色：色相 0~75 (红橙黄) 或者 300~360 (洋红/粉红)
  if ((h >= 0 && h <= 75) || (h >= 300 && h <= 360)) return 'warm';
  // 冷色：色相 105~255 (绿/青/蓝/紫)
  if (h >= 105 && h <= 255) return 'cool';
  return 'neutral';
}

/** 
 * 核心算法：将任意 RGB 颜色强制约束到莫兰迪色域 (低饱和、中高亮度)
 * 家纺高级感：饱和度 (S) 限制在 20%-35%，亮度 (L) 限制在 65%-85%
 */
export function clampToMorandiColor(r: number, g: number, b: number) {
  let [h, s, l] = rgbToHsl(r, g, b);
  
  // 对于几乎无色的灰白黑，不强制拉高饱和度
  if (s > 10) {
    s = Math.max(20, Math.min(s, 35)); // 强制压低/限制饱和度到 20-35 的区间
  }
  
  // 亮度约束到中间带偏明亮，避免荧光也避免过暗
  l = Math.max(65, Math.min(l, 85));

  const [nr, ng, nb] = hslToRgb(h, s, l);
  const hex = `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`.toUpperCase();
  const name = getColorName(nr, ng, nb);
  const temp = getColorTemperature(h, s);

  return { hex, name, rgb: { r: nr, g: ng, b: nb }, colorTemperature: temp };
}

/**
 * 🔑 自适应色彩引擎 — 替代全局一刀切的莫兰迪降色
 *
 * 豁免条件 (Bypass Logic):
 * 1. Lightness < 45% → 深色系（深蓝、墨绿、深红等）→ 保持原色
 * 2. Saturation > 75% 且 Hue 在红色区间 (340°-360° 或 0°-20°) → 高饱和喜庆红 → 保持原色
 *
 * 非豁免 → 执行莫兰迪算法（S: 20-35%, L: 65-85%）
 */
export function adaptiveColorEngine(r: number, g: number, b: number): {
  hex: string;
  name: string;
  rgb: { r: number; g: number; b: number };
  colorTemperature: 'cool' | 'warm' | 'neutral';
  bypassed: boolean;
  bypassReason?: string;
} {
  const [h, s, l] = rgbToHsl(r, g, b);

  // 豁免条件1：深色系（明度 < 45%）
  if (l < 45) {
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    const name = getColorName(r, g, b);
    const temp = getColorTemperature(h, s);
    return { hex, name, rgb: { r, g, b }, colorTemperature: temp, bypassed: true, bypassReason: '深色系' };
  }

  // 豁免条件2：高饱和喜庆红（饱和度 > 75% 且 色相在红色区间 340°-360° 或 0°-20°）
  if (s > 75 && (h >= 340 || h <= 20)) {
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    const name = getColorName(r, g, b);
    const temp = getColorTemperature(h, s);
    return { hex, name, rgb: { r, g, b }, colorTemperature: temp, bypassed: true, bypassReason: '喜庆红' };
  }

  // 非豁免 → 执行莫兰迪降色算法
  const morandi = clampToMorandiColor(r, g, b);
  return { ...morandi, bypassed: false };
}

/**
 * 🔑 后处理自动裁边 — 检测并裁切四周纯色边框
 * 用于花型提取后自动去除 AI 生成的白边/纯色边框
 *
 * @param base64 输入图片 base64
 * @param tolerance 颜色容差（默认 15），同一行/列内像素与边角颜色差值在此范围内视为边框
 * @returns 裁切后的 base64 图片（如果没有检测到边框则返回原图）
 */
export async function trimWhiteBorder(base64: string, tolerance = 15): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const w = img.width;
      const h = img.height;
      const imageData = ctx.getImageData(0, 0, w, h).data;

      // 取左上角像素作为边框颜色参考
      const refR = imageData[0], refG = imageData[1], refB = imageData[2];

      const isEdgePixel = (idx: number) => {
        return Math.abs(imageData[idx] - refR) <= tolerance &&
               Math.abs(imageData[idx + 1] - refG) <= tolerance &&
               Math.abs(imageData[idx + 2] - refB) <= tolerance;
      };

      // 检测上边框
      let top = 0;
      topLoop: for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!isEdgePixel((y * w + x) * 4)) break topLoop;
        }
        top = y + 1;
      }

      // 检测下边框
      let bottom = h;
      bottomLoop: for (let y = h - 1; y >= top; y--) {
        for (let x = 0; x < w; x++) {
          if (!isEdgePixel((y * w + x) * 4)) break bottomLoop;
        }
        bottom = y;
      }

      // 检测左边框
      let left = 0;
      leftLoop: for (let x = 0; x < w; x++) {
        for (let y = top; y < bottom; y++) {
          if (!isEdgePixel((y * w + x) * 4)) break leftLoop;
        }
        left = x + 1;
      }

      // 检测右边框
      let right = w;
      rightLoop: for (let x = w - 1; x >= left; x--) {
        for (let y = top; y < bottom; y++) {
          if (!isEdgePixel((y * w + x) * 4)) break rightLoop;
        }
        right = x;
      }

      // 计算裁切后宽高
      const cropW = right - left;
      const cropH = bottom - top;

      // 如果边框宽度不足图片尺寸的 2%，不裁
      const minBorder = Math.min(w, h) * 0.02;
      if (top < minBorder && (h - bottom) < minBorder && left < minBorder && (w - right) < minBorder) {
        resolve(base64); // 没有明显边框，返回原图
        return;
      }

      // 如果裁切后太小，放弃裁切
      if (cropW < w * 0.5 || cropH < h * 0.5) {
        resolve(base64);
        return;
      }

      // 执行裁切
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      cropCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
      resolve(cropCanvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => resolve(base64); // 失败时返回原图
    img.src = `data:image/png;base64,${base64}`;
  });
}

/** 顺时针旋转图片 90° */
export async function rotateImage90(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.height;
      canvas.height = img.width;
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => reject(new Error('图片旋转失败'));
    img.src = `data:image/png;base64,${base64}`;
  });
}

/** 将 File 读取为 base64 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/** 下载 base64 图片 */
export function downloadBase64Image(base64: string, filename?: string): void {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64}`;
  link.download = filename || `zhimeng_${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

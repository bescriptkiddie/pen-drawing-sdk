// src/utils/math.js

/**
 * 将值限制在指定范围内
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Sigmoid压力映射：增强中段压力灵敏度
 * @param {number} x 原始压力值 0~1
 * @param {number} k 调整斜率（默认 6）
 * @param {number} shift 偏移中心点（默认 0.3）
 * @returns {number}
 */
export function sigmoidPressure(x, k = 6, shift = 0.3) {
  const s = 1 / (1 + Math.exp(-k * (x - shift)))
  return clamp(s, 0.05, 0.95)
}

/**
 * 简单线性插值
 * @param {number} a 起点值
 * @param {number} b 终点值
 * @param {number} t 插值系数 0~1
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a * (1 - t) + b * t
}

/**
 * Catmull-Rom 曲线插值（返回插值点数组）
 * @param {Object} p0 前一个点
 * @param {Object} p1 当前点
 * @param {Object} p2 下一个点
 * @param {Object} p3 再下一个点
 * @param {number} steps 插值点数
 * @returns {Array<{x: number, y: number}>}
 */
export function catmullRom(p0, p1, p2, p3, steps = 10) {
  const result = []
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1)
    const t2 = t * t
    const t3 = t2 * t

    const h1 = -0.5 * t3 + t2 - 0.5 * t
    const h2 = 1.5 * t3 - 2.5 * t2 + 1
    const h3 = -1.5 * t3 + 2 * t2 + 0.5 * t
    const h4 = 0.5 * t3 - 0.5 * t2

    const x = h1 * p0.x + h2 * p1.x + h3 * p2.x + h4 * p3.x
    const y = h1 * p0.y + h2 * p1.y + h3 * p2.y + h4 * p3.y

    result.push({ x, y })
  }
  return result
}

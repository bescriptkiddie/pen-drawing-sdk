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

/**
 * 二维向量计算工具
 * 提供向量基本运算方法，方便绘图算法使用
 */
export const Vec2 = {
  /**
   * 计算向量长度
   * @param {{x: number, y: number}} v 向量
   * @returns {number} 向量长度
   */
  length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y) || 0.001 // 避免除以零
  },

  /**
   * 计算两点之间的距离
   * @param {{x: number, y: number}} p1 第一个点
   * @param {{x: number, y: number}} p2 第二个点
   * @returns {number} 两点间距离
   */
  distance(p1, p2) {
    return Vec2.length({ x: p2.x - p1.x, y: p2.y - p1.y })
  },

  /**
   * 归一化向量（单位向量）
   * @param {{x: number, y: number}} v 向量
   * @returns {{x: number, y: number}} 归一化后的向量
   */
  normalize(v) {
    const len = Vec2.length(v)
    return {
      x: v.x / len,
      y: v.y / len
    }
  },

  /**
   * 创建从p1指向p2的向量
   * @param {{x: number, y: number}} p1 起点
   * @param {{x: number, y: number}} p2 终点
   * @returns {{x: number, y: number}} 从p1到p2的向量
   */
  fromPoints(p1, p2) {
    return {
      x: p2.x - p1.x,
      y: p2.y - p1.y
    }
  },

  /**
   * 计算两个向量的点积
   * @param {{x: number, y: number}} v1 向量1
   * @param {{x: number, y: number}} v2 向量2
   * @returns {number} 点积结果
   */
  dot(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y
  },

  /**
   * 按比例缩放向量
   * @param {{x: number, y: number}} v 原向量
   * @param {number} scale 缩放比例
   * @returns {{x: number, y: number}} 缩放后的向量
   */
  scale(v, scale) {
    return {
      x: v.x * scale,
      y: v.y * scale
    }
  },

  /**
   * 将一个向量加到另一个向量上
   * @param {{x: number, y: number}} v1 向量1
   * @param {{x: number, y: number}} v2 向量2
   * @returns {{x: number, y: number}} 相加后的向量
   */
  add(v1, v2) {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y
    }
  },

  /**
   * 线性插值两个向量
   * @param {{x: number, y: number}} v1 起始向量
   * @param {{x: number, y: number}} v2 结束向量
   * @param {number} t 插值系数 (0-1)
   * @returns {{x: number, y: number}} 插值结果
   */
  lerp(v1, v2, t) {
    return {
      x: lerp(v1.x, v2.x, t),
      y: lerp(v1.y, v2.y, t)
    }
  }
}

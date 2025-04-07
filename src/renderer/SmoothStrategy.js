// src/renderer/SmoothStrategy.js

import { catmullRom, lerp } from "../utils/math.js"

/**
 * SmoothStrategy：提供笔画路径平滑插值能力（默认 Catmull-Rom）
 */
export class SmoothStrategy {
  constructor({ enabled = true, steps = 4 }) {
    this.enabled = enabled
    this.steps = steps
  }

  /**
   * 对路径点应用插值
   * @param {Array<{x, y}>} points
   * @param {Array<number>} pressures
   * @returns {{ points: Array, pressures: Array }}
   */
  apply(points, pressures) {
    if (!this.enabled || points.length < 4) {
      return { points, pressures }
    }

    const smoothed = []
    const smoothedPressures = []

    for (let i = 1; i < points.length - 2; i++) {
      const p0 = points[i - 1]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2]

      const interp = catmullRom(p0, p1, p2, p3, this.steps)

      for (let j = 0; j < interp.length; j++) {
        const t = j / interp.length
        smoothed.push(interp[j])
        smoothedPressures.push(lerp(pressures[i], pressures[i + 1], t))
      }
    }

    return { points: smoothed, pressures: smoothedPressures }
  }
}

/**
 * 生成二次 Bézier 控制点（简化计算）
 * 输入：p0 (前一点), p1 (当前点), p2 (后一点)
 * 输出：控制点 cx, cy，用于 curveTo(p0 → p1 → p2)
 */
export function getQuadraticControlPoints(p0, p1, p2) {
  return {
    cx: (p0.x + p2.x) / 2,
    cy: (p0.y + p2.y) / 2
  }
}

// src/renderer/SmoothStrategy.js

import { catmullRom, lerp } from "../utils/math.js"

/**
 * SmoothStrategy 类
 *
 * 提供笔画路径平滑插值能力，主要使用 Catmull-Rom 样条插值算法。
 * 这个类用于在渲染前对笔画点进行预处理，增加中间点，使曲线更平滑。
 * 适用于高质量渲染模式或需要精确平滑的场景。
 */
export class SmoothStrategy {
  /**
   * 创建一个平滑策略实例
   *
   * @param {Object} options - 配置选项
   * @param {boolean} options.enabled - 是否启用平滑
   * @param {number} options.steps - 插值步数，值越大曲线越平滑，但点数也越多
   */
  constructor({ enabled = true, steps = 4 }) {
    this.enabled = enabled
    this.steps = steps
  }

  /**
   * 对路径点应用插值算法
   *
   * 使用 Catmull-Rom 样条插值在相邻点之间插入额外的点，使路径更平滑。
   * 同时对压力值进行线性插值，确保压力过渡自然。
   *
   * 注意: 这个方法需要至少4个点才能正常工作。
   *
   * @param {Array<{x, y}>} points - 原始点数组
   * @param {Array<number>} pressures - 原始压力值数组
   * @returns {{ points: Array, pressures: Array }} 插值后的点和压力值
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

      // 使用Catmull-Rom算法在p1和p2之间插入中间点
      const interp = catmullRom(p0, p1, p2, p3, this.steps)

      // 对每个插入的点，同时插值对应的压力值
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
 * 生成二次贝塞尔曲线的控制点（简化版）
 *
 * 这是最简单的控制点计算方法，将控制点设为前后两点的中点。
 * 适用于简单场景，但在高速或急转弯处效果不佳。
 *
 * @param {Object} p0 - 起始点 {x, y}
 * @param {Object} p1 - 中间点 {x, y}
 * @param {Object} p2 - 终点 {x, y}
 * @returns {Object} 控制点坐标 {cx, cy}
 */
export function getQuadraticControlPoints(p0, p1, p2) {
  return {
    cx: (p0.x + p2.x) / 2,
    cy: (p0.y + p2.y) / 2
  }
}

/**
 * 计算基于动量的二次贝塞尔曲线控制点
 *
 * 该算法考虑了笔迹的运动趋势和转弯角度，生成更自然的曲线：
 * 1. 计算前后段向量并归一化
 * 2. 基于转弯角度调整动量因子
 * 3. 根据运动方向的连续性计算混合方向
 * 4. 使用上述因素计算出最佳控制点位置
 *
 * 这种方法尤其适合处理手写笔迹的流畅性和连续性。
 *
 * @param {Object} p0 - 起始点 {x, y}
 * @param {Object} p1 - 中间点 {x, y}
 * @param {Object} p2 - 终点 {x, y}
 * @param {Object} options - 控制参数
 * @param {number} options.momentumFactor - 动量因子(0~1)，越大曲线越圆滑
 * @returns {Object} 控制点坐标 {cx, cy}
 */
export function getMomentumControlPoint(p0, p1, p2, options = {}) {
  // 计算运动向量
  const v1x = p1.x - p0.x
  const v1y = p1.y - p0.y
  const v2x = p2.x - p1.x
  const v2y = p2.y - p1.y

  // 计算向量长度
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 0.001
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 0.001

  // 动量跟随因子 - 调整曲线的"惯性"
  const momentumFactor = options.momentumFactor || 0.4 // 增加默认动量因子

  // 计算两个向量的单位向量
  const u1x = v1x / len1
  const u1y = v1y / len1
  const u2x = v2x / len2
  const u2y = v2y / len2

  // 基于两段向量的夹角计算控制点位置
  const dotProduct = u1x * u2x + u1y * u2y

  // 曲率因子：角度变化越大，控制点需要更强的调整
  // 当dotProduct接近-1（接近180度转弯）时，曲率因子接近2
  // 当dotProduct接近1（直线）时，曲率因子接近0
  const curvatureFactor = Math.max(0, 1 - dotProduct)

  // 根据曲率自适应调整动量
  const adaptiveMomentum = momentumFactor * (1 + curvatureFactor)

  // 根据转弯角度计算控制点位置
  // 在急转弯处，更倾向于使用前一段的方向
  const blendFactor = Math.min(1, Math.max(0, (1 + dotProduct) / 1.5))

  // 计算混合向量（根据角度混合两段向量的方向）
  const blendX = u1x * (1 - blendFactor) + u2x * blendFactor
  const blendY = u1y * (1 - blendFactor) + u2y * blendFactor

  // 标准化混合向量
  const blendLen = Math.sqrt(blendX * blendX + blendY * blendY) || 0.001
  const normBlendX = blendX / blendLen
  const normBlendY = blendY / blendLen

  // 控制点长度 - 使用自适应动量和混合向量的长度
  const controlLen = ((len1 + len2) / 2) * adaptiveMomentum

  return {
    cx: p1.x + normBlendX * controlLen,
    cy: p1.y + normBlendY * controlLen
  }
}

/**
 * 计算基于四点的三次贝塞尔曲线控制点
 *
 * 这是最强大的曲线控制点计算方法，适用于复杂笔迹的中间段：
 * 1. 分析三段向量的方向和速度
 * 2. 基于曲率和速度计算自适应控制因子
 * 3. 对急转弯和直线段采用不同的混合策略
 * 4. 生成两个控制点以创建平滑的三次贝塞尔曲线
 *
 * 这种方法能很好地保持笔迹的连续性、流畅度和形状特征。
 *
 * @param {Object} p0 - 第一个点 {x, y}
 * @param {Object} p1 - 第二个点 {x, y}（曲线起点）
 * @param {Object} p2 - 第三个点 {x, y}（曲线终点）
 * @param {Object} p3 - 第四个点 {x, y}
 * @param {Object} options - 控制参数
 * @param {number} options.controlFactor - 控制强度因子
 * @param {number} options.speedThreshold - 速度阈值，用于自适应控制
 * @returns {Object} 两个控制点坐标 {cp1x, cp1y, cp2x, cp2y}
 */
export function getCubicMomentumControlPoints(p0, p1, p2, p3, options = {}) {
  // 计算相邻段的向量
  const v1 = { x: p1.x - p0.x, y: p1.y - p0.y }
  const v2 = { x: p2.x - p1.x, y: p2.y - p1.y }
  const v3 = { x: p3.x - p2.x, y: p3.y - p2.y }

  // 向量长度（代表速度）
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001
  const len3 = Math.sqrt(v3.x * v3.x + v3.y * v3.y) || 0.001

  // 单位向量（代表方向）
  const u1 = { x: v1.x / len1, y: v1.y / len1 }
  const u2 = { x: v2.x / len2, y: v2.y / len2 }
  const u3 = { x: v3.x / len3, y: v3.y / len3 }

  // 点积计算转弯角度（-1到1之间，1表示同向，-1表示反向）
  const dp1 = u1.x * u2.x + u1.y * u2.y
  const dp2 = u2.x * u3.x + u2.y * u3.y

  // 曲率因子：角度变化越大，曲率因子越高
  const curvature1 = Math.max(0, 1 - dp1)
  const curvature2 = Math.max(0, 1 - dp2)

  // 速度因子 - 速度越快，控制点距离越长
  const speed = (len1 + len2 + len3) / 3
  const speedFactor = Math.min(1, speed / (options.speedThreshold || 25))

  // 基础控制因子
  const baseControlFactor = options.controlFactor || 0.35 // 增加基础控制因子

  // 计算贝塞尔控制点长度 - 曲率自适应
  // 曲率大时增加控制点长度，使曲线更顺滑
  const ctrl1Len =
    len2 * baseControlFactor * (1 + curvature1 * 0.75 + speedFactor * 0.5)
  const ctrl2Len =
    len2 * baseControlFactor * (1 + curvature2 * 0.75 + speedFactor * 0.5)

  // 混合向量计算 - 根据转弯角度平滑混合方向
  // 转弯小时，混合更多下一段的方向；转弯大时，保持当前方向
  const blendFactor1 = Math.min(1, Math.max(0, (1 + dp1) / 1.5))
  const blendFactor2 = Math.min(1, Math.max(0, (1 + dp2) / 1.5))

  // 混合前后两段的方向
  // 在急转弯处更偏向于维持当前运动方向
  const blend1 = {
    x: u1.x * (1 - blendFactor1 * 0.7) + u2.x * blendFactor1 * 0.3,
    y: u1.y * (1 - blendFactor1 * 0.7) + u2.y * blendFactor1 * 0.3
  }

  const blend2 = {
    x: u2.x * (1 - blendFactor2 * 0.3) + u3.x * blendFactor2 * 0.7,
    y: u2.y * (1 - blendFactor2 * 0.3) + u3.y * blendFactor2 * 0.7
  }

  // 标准化混合向量
  const blend1Len =
    Math.sqrt(blend1.x * blend1.x + blend1.y * blend1.y) || 0.001
  const blend2Len =
    Math.sqrt(blend2.x * blend2.x + blend2.y * blend2.y) || 0.001

  const norm1 = {
    x: blend1.x / blend1Len,
    y: blend1.y / blend1Len
  }

  const norm2 = {
    x: blend2.x / blend2Len,
    y: blend2.y / blend2Len
  }

  // 计算最终的控制点坐标
  // 第一个控制点从p1出发，沿着混合方向1
  // 第二个控制点从p2出发，沿着混合方向2的反方向
  const cp1x = p1.x + norm1.x * ctrl1Len
  const cp1y = p1.y + norm1.y * ctrl1Len
  const cp2x = p2.x - norm2.x * ctrl2Len
  const cp2y = p2.y - norm2.y * ctrl2Len

  return {
    cp1x,
    cp1y,
    cp2x,
    cp2y
  }
}

/**
 * 计算笔画终点段的三次贝塞尔曲线控制点
 *
 * 专为笔画的首尾段设计的控制点计算方法：
 * 1. 考虑终点的特殊性，适当缩短控制点距离
 * 2. 在急转弯处增强曲率补偿
 * 3. 结合速度和角度信息，微调控制点位置
 *
 * 这种方法能使笔画在开始和结束时都具有自然的过渡效果。
 *
 * @param {Object} prev - 前一个点 {x, y}
 * @param {Object} curr - 当前点 {x, y}（曲线起点）
 * @param {Object} next - 下一个点 {x, y}（曲线终点）
 * @param {Object} options - 控制参数
 * @param {number} options.momentumFactor - 动量因子
 * @param {number} options.speedThreshold - 速度阈值
 * @param {number} options.endFactor - 终点控制点因子
 * @param {boolean} options.isLastSegment - 是否为笔画的最后一段
 * @returns {Object} 两个控制点坐标 {cp1x, cp1y, cp2x, cp2y}
 */
export function getFinalSegmentControlPoints(prev, curr, next, options = {}) {
  // 计算动量向量
  const v1x = curr.x - prev.x
  const v1y = curr.y - prev.y
  const v2x = next.x - curr.x
  const v2y = next.y - curr.y

  // 向量长度
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 0.001
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 0.001

  // 单位向量
  const u1x = v1x / len1
  const u1y = v1y / len1
  const u2x = v2x / len2
  const u2y = v2y / len2

  // 计算点积，判断角度变化
  const dotProduct = u1x * u2x + u1y * u2y

  // 转弯角度因子
  const curvatureFactor = Math.max(0, 1 - dotProduct)

  // 根据速度和角度动态调整控制点长度
  const speedFactor = Math.min(1, len2 / (options.speedThreshold || 30))
  const baseMomentum = options.momentumFactor || 0.4

  // 检测是否是笔画的最后一段
  const isLastSegment = options.isLastSegment === true

  // 第一个控制点 - 增强曲率补偿
  // 在急转弯处使用更长的控制点距离
  let cp1Momentum = baseMomentum * (1 + curvatureFactor + speedFactor * 0.5)

  // 如果是最后一段，根据速度动态调整动量，避免"甩尾"
  if (isLastSegment) {
    // 速度越慢，终点动量越小，减少甩尾现象
    const speedReductionFactor = Math.max(0.2, Math.min(1, len2 / 10))
    cp1Momentum *= speedReductionFactor

    // 如果终点与前一段接近共线，则进一步减少曲率
    if (dotProduct > 0.7) {
      cp1Momentum *= 0.7
    }
  }

  // 混合两个方向的向量以获得更平滑的过渡
  // 在转弯处更偏向于前一段的方向
  const blendFactor = Math.min(1, Math.max(0, (1 + dotProduct) / 1.5))
  const blendX = u1x * (1 - blendFactor * 0.5) + u2x * blendFactor * 0.5
  const blendY = u1y * (1 - blendFactor * 0.5) + u2y * blendFactor * 0.5

  // 标准化混合向量
  const blendLen = Math.sqrt(blendX * blendX + blendY * blendY) || 0.001
  const normalizedBlendX = blendX / blendLen
  const normalizedBlendY = blendY / blendLen

  // 控制点长度
  const cp1Len = len2 * cp1Momentum

  // 第一个控制点 - 使用混合方向
  const cp1x = curr.x + normalizedBlendX * cp1Len
  const cp1y = curr.y + normalizedBlendY * cp1Len

  // 第二个控制点 - 靠近终点，但根据曲率调整
  // 在急转弯处，第二个控制点离终点更近
  let endFactor = options.endFactor || 0.15

  // 最后一段特殊处理，让第二个控制点更靠近终点
  if (isLastSegment) {
    endFactor *= 0.7
  }

  const cp2Factor = endFactor * (1 - curvatureFactor * 0.5)
  const cp2x = next.x - v2x * cp2Factor
  const cp2y = next.y - v2y * cp2Factor

  return { cp1x, cp1y, cp2x, cp2y }
}

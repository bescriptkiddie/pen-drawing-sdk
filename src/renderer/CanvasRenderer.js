import {
  getQuadraticControlPoints,
  getMomentumControlPoint,
  getCubicMomentumControlPoints,
  getFinalSegmentControlPoints
} from "./SmoothStrategy.js"
import { Vec2 } from "../utils/math.js"

/**
 * CanvasRenderer类
 * 负责在Canvas上渲染笔画，是最终绘制内容的渲染器
 *
 * 渲染过程采用多种贝塞尔曲线插值算法，使笔画呈现平滑、自然的效果。
 * 根据设备性能和笔画复杂度，可以动态在高质量和优化渲染模式间切换。
 */
export class CanvasRenderer {
  /**
   * 创建CanvasRenderer实例
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D绘图上下文
   * @param {number} dpr - 设备像素比，用于高分辨率屏幕
   * @param {Object} options - 渲染配置选项
   */
  constructor(ctx, dpr = 1, options = {}) {
    this.ctx = ctx
    this.dpr = dpr
    this.minPointsForCurve = 3
    this.lowFPS = options.lowFPS ?? false // 是否使用低帧率优化模式
    this.smoothSteps = options.smoothSteps ?? 4 // 平滑插值步数
    // 增加额外的控制参数以匹配预览渲染的质量
    this.angleThreshold = options.angleThreshold ?? 0.06 // 角度变化阈值，较小的值保留更多的角度变化点
    this.distanceThreshold = options.distanceThreshold ?? 6 // 距离阈值，较小的值保留更多点
    this.momentumFactor = options.momentumFactor ?? 0.5 // 贝塞尔曲线动量因子，影响曲线的"惯性"
    this.curveFactor = options.curveFactor ?? 0.35 // 曲线平滑因子，值越大曲线越圆滑

    // 添加低帧率专用参数
    this.lowFPSAngleThreshold = options.lowFPSAngleThreshold ?? 0.04 // 更敏感的角度阈值
    this.lowFPSDistanceThreshold = options.lowFPSDistanceThreshold ?? 4 // 更短的距离阈值
    this.lowFPSMaxSkipPoints = options.lowFPSMaxSkipPoints ?? 2 // 低帧率下最多跳过2点
    this.lowFPSMomentumFactor = options.lowFPSMomentumFactor ?? 0.6 // 更强的曲线平滑
    this.lowFPSCurveFactor = options.lowFPSCurveFactor ?? 0.45 // 更强的曲线因子
  }

  /**
   * 清除画布内容
   * @param {number} width - 画布宽度
   * @param {number} height - 画布高度
   */
  clearCanvas(width, height) {
    this.ctx.clearRect(0, 0, width / this.dpr, height / this.dpr)
  }

  /**
   * 渲染多个笔画
   * @param {Array<Stroke>} strokes - 笔画对象数组
   */
  renderStrokes(strokes) {
    for (const stroke of strokes) {
      this.renderStroke(stroke)
    }
  }

  /**
   * 渲染单个笔画
   *
   * 根据笔画的点数量和当前性能模式选择合适的渲染方法:
   * - 单点处理: 渲染为圆点
   * - 低帧率/点数多: 使用优化的渲染方式
   * - 普通情况: 使用高质量渲染
   *
   * @param {Stroke} stroke - 要渲染的笔画对象
   */
  renderStroke(stroke) {
    const points = stroke.points
    const pressures = stroke.pressures
    if (points.length < 2) return

    this.ctx.save()
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over"
    this.ctx.strokeStyle = stroke.color

    // 单点处理 - 绘制为一个圆点
    if (points.length === 1) {
      this.ctx.beginPath()
      this.ctx.arc(
        points[0].x,
        points[0].y,
        stroke.baseSize * 0.5,
        0,
        Math.PI * 2
      )
      this.ctx.fill()
      this.ctx.restore()
      return
    }

    // 低帧率模式下使用更优化的渲染方式，但保持较高的质量
    if (this.lowFPS && points.length > 10) {
      this._renderOptimizedStroke(stroke, points, pressures)
    } else {
      this._renderHighQualityStroke(stroke, points, pressures)
    }

    this.ctx.restore()
  }

  /**
   * 渲染优化版本的笔画
   *
   * 在低帧率模式下使用，通过减少处理的点数量来提高性能，同时保持平滑视觉效果:
   * 1. 对原始点进行智能采样，保留关键点
   * 2. 重新计算采样点的压力值
   * 3. 使用贝塞尔曲线渲染平滑路径
   *
   * @param {Stroke} stroke - 笔画对象
   * @param {Array<{x,y}>} points - 原始点数组
   * @param {Array<number>} pressures - 原始压力值数组
   * @private
   */
  _renderOptimizedStroke(stroke, points, pressures) {
    // 1. 低帧率预平滑 (新增)
    let processedPoints = points
    let processedPressures = pressures

    if (this.lowFPS) {
      const smoothed = this._preSmoothPointsForLowFPS(points, pressures)
      processedPoints = smoothed.points
      processedPressures = smoothed.pressures
    }

    // 2. 采样
    const simplifiedPoints = this._sampleKeyPoints(processedPoints)
    const simplifiedPressures = this._resamplePressures(
      processedPressures,
      processedPoints,
      simplifiedPoints
    )

    // 至少需要2个点才能画线
    if (simplifiedPoints.length < 2) return

    this.ctx.beginPath()
    this._renderSmoothedPath(simplifiedPoints, simplifiedPressures, stroke)
  }

  /**
   * 低帧率下的点预平滑
   *
   * 在低帧率模式下，对点进行预平滑处理以减少抖动
   * 使用自适应加权平滑算法，根据转弯程度调整平滑强度
   *
   * @param {Array<{x,y}>} points - 原始点数组
   * @param {Array<number>} pressures - 原始压力值数组
   * @returns {Object} 包含平滑后的点和压力值
   * @private
   */
  _preSmoothPointsForLowFPS(points, pressures) {
    // 仅在低帧率模式下、点数足够时应用
    if (!this.lowFPS || points.length <= 4) {
      return { points, pressures }
    }

    const smoothedPoints = []
    const smoothedPressures = []

    // 保留首尾点不变
    smoothedPoints.push(points[0])
    smoothedPressures.push(pressures[0])

    // 对中间点应用平滑
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      // 计算当前点与前后点的向量
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y }
      const v2 = { x: next.x - curr.x, y: next.y - curr.y }
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001

      // 归一化向量
      const u1 = { x: v1.x / len1, y: v1.y / len1 }
      const u2 = { x: v2.x / len2, y: v2.y / len2 }

      // 计算点积，判断角度变化
      const dotProduct = u1.x * u2.x + u1.y * u2.y

      // 加权平均计算平滑点
      // 中心点权重为2，前后点权重为1
      const smoothX = (prev.x + curr.x * 2 + next.x) / 4
      const smoothY = (prev.y + curr.y * 2 + next.y) / 4

      // 根据角度变化调整平滑强度
      // 转弯处(角度变化大)保留更多原始信息
      if (dotProduct < 0.7) {
        // 大约45度以上的转弯
        // 转弯点使用轻度平滑
        smoothedPoints.push({
          x: (curr.x * 3 + smoothX) / 4, // 75%原始 + 25%平滑
          y: (curr.y * 3 + smoothY) / 4
        })
      } else {
        // 非转弯点使用标准平滑
        smoothedPoints.push({
          x: smoothX,
          y: smoothY
        })
      }

      // 平滑压力值
      const smoothPressure =
        (pressures[i - 1] + pressures[i] * 2 + pressures[i + 1]) / 4
      smoothedPressures.push(smoothPressure)
    }

    // 保留最后一个点
    smoothedPoints.push(points[points.length - 1])
    smoothedPressures.push(pressures[pressures.length - 1])

    return { points: smoothedPoints, pressures: smoothedPressures }
  }

  /**
   * 智能采样关键点算法
   *
   * 根据以下策略选择性保留点:
   * 1. 角度变化显著的点（转弯点）
   * 2. 与上一个点距离超过阈值的点
   * 3. 确保连续点之间不会跳过太多原始点
   *
   * 这种采样可以大幅减少点数量，同时保留笔画的关键形状特征
   *
   * @param {Array<{x,y}>} points - 原始点数组
   * @returns {Array<{x,y}>} 采样后的点数组
   * @private
   */
  _sampleKeyPoints(points) {
    if (points.length <= 3) return [...points]

    const result = [points[0]]
    let lastAddedIndex = 0

    // 根据帧率模式选择参数
    const angleThreshold = this.lowFPS
      ? this.lowFPSAngleThreshold
      : this.angleThreshold
    const distanceThreshold = this.lowFPS
      ? this.lowFPSDistanceThreshold
      : this.distanceThreshold
    const maxSkipPoints = this.lowFPS ? this.lowFPSMaxSkipPoints : 4

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[lastAddedIndex]
      const curr = points[i]
      const next = points[i + 1]

      // 计算当前点与上一个添加点的距离
      const distFromLast = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      )

      // 计算方向变化
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y }
      const v2 = { x: next.x - curr.x, y: next.y - curr.y }
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001

      // 归一化向量
      const u1 = { x: v1.x / len1, y: v1.y / len1 }
      const u2 = { x: v2.x / len2, y: v2.y / len2 }

      // 计算点积，判断角度变化
      const dotProduct = u1.x * u2.x + u1.y * u2.y
      const angleChange = Math.acos(Math.max(-1, Math.min(1, dotProduct)))

      // 根据曲率调整距离阈值 - 曲率大时降低阈值保留更多点
      const curvatureAdaptiveThreshold =
        distanceThreshold * (0.2 + 0.8 * Math.min(1, (1 + dotProduct) / 2))

      // 保留点的条件
      if (
        angleChange > angleThreshold || // 角度变化大于阈值
        distFromLast > curvatureAdaptiveThreshold || // 距离大于自适应阈值
        i - lastAddedIndex > maxSkipPoints // 最多跳过maxSkipPoints个点
      ) {
        result.push(curr)
        lastAddedIndex = i
      }
    }

    // 添加最后一个点
    if (lastAddedIndex < points.length - 1) {
      result.push(points[points.length - 1])
    }

    return result
  }

  /**
   * 重新采样压力值
   *
   * 根据采样后的点，从原始点集中找出最接近的点并获取其压力值
   * 这确保了即使点被减少，压力变化的特征仍然保持
   *
   * @param {Array<number>} pressures - 原始压力值数组
   * @param {Array<{x,y}>} originalPoints - 原始点数组
   * @param {Array<{x,y}>} sampledPoints - 采样后的点数组
   * @returns {Array<number>} 采样后的压力值数组
   * @private
   */
  _resamplePressures(pressures, originalPoints, sampledPoints) {
    if (originalPoints.length !== pressures.length) {
      // 压力值和点不匹配时的简单处理
      return sampledPoints.map(() => 0.5)
    }

    const result = []

    // 启发式搜索优化：
    // 1. 假设大多数采样点与原始点的顺序关系保持一致
    // 2. 从上一个找到的最近点开始搜索，而不是每次都从头开始
    // 3. 使用局部窗口搜索，大幅减少计算量

    let lastFoundIndex = 0
    const searchWindowSize = Math.min(20, Math.ceil(originalPoints.length / 4)) // 动态窗口大小

    for (const point of sampledPoints) {
      let minDist = Infinity
      let closestIndex = lastFoundIndex

      // 定义搜索窗口范围
      const startIdx = Math.max(0, lastFoundIndex - searchWindowSize)
      const endIdx = Math.min(
        originalPoints.length - 1,
        lastFoundIndex + searchWindowSize
      )

      // 在窗口内搜索最近点
      for (let i = startIdx; i <= endIdx; i++) {
        const dist = Math.sqrt(
          Math.pow(point.x - originalPoints[i].x, 2) +
            Math.pow(point.y - originalPoints[i].y, 2)
        )

        if (dist < minDist) {
          minDist = dist
          closestIndex = i
        }
      }

      // 如果窗口边缘点最近，扩大搜索范围再检查一次
      if (closestIndex === startIdx || closestIndex === endIdx) {
        const extendedStart = Math.max(0, startIdx - searchWindowSize)
        const extendedEnd = Math.min(
          originalPoints.length - 1,
          endIdx + searchWindowSize
        )

        // 只搜索扩展的部分
        const searchStart = closestIndex === startIdx ? extendedStart : startIdx
        const searchEnd = closestIndex === endIdx ? extendedEnd : endIdx

        for (let i = searchStart; i <= searchEnd; i++) {
          // 跳过已经搜索过的窗口
          if (i >= startIdx && i <= endIdx) continue

          const dist = Math.sqrt(
            Math.pow(point.x - originalPoints[i].x, 2) +
              Math.pow(point.y - originalPoints[i].y, 2)
          )

          if (dist < minDist) {
            minDist = dist
            closestIndex = i
          }
        }
      }

      lastFoundIndex = closestIndex
      result.push(pressures[closestIndex] || 0.5)
    }

    return result
  }

  /**
   * 渲染平滑路径
   *
   * 使用贝塞尔曲线算法渲染平滑的路径:
   * - 两点: 直接连线
   * - 三点: 使用二次贝塞尔曲线
   * - 四点或更多: 使用不同策略的三次贝塞尔曲线
   *   - 急转弯: 特殊处理保持锐利的转角
   *   - 起始/结束段: 使用终点段处理
   *   - 中间段: 使用四点动量控制的贝塞尔曲线
   *
   * @param {Array<{x,y}>} points - 点数组
   * @param {Array<number>} pressures - 压力值数组
   * @param {Stroke} stroke - 笔画对象
   * @private
   */
  _renderSmoothedPath(points, pressures, stroke) {
    if (points.length < 2) return

    this.ctx.moveTo(points[0].x, points[0].y)

    // 设置第一个线宽
    const firstPressure = pressures[0] || 0.5
    this.ctx.lineWidth = stroke.baseSize * (0.5 + firstPressure)

    // 如果只有两个点，直接连线
    if (points.length === 2) {
      this.ctx.lineTo(points[1].x, points[1].y)
      this.ctx.stroke()
      return
    }

    // 使用贝塞尔曲线绘制连续的点
    let i = 0
    while (i < points.length - 1) {
      // 根据可用点的数量选择不同的曲线绘制策略
      const remainingPoints = points.length - i

      // 更新线宽
      const pressure = pressures[i] || 0.5
      this.ctx.lineWidth = stroke.baseSize * (0.5 + pressure)

      // 只剩下两个点 - 直接连线
      if (remainingPoints === 2) {
        this.ctx.lineTo(points[i + 1].x, points[i + 1].y)
        break
      }
      // 有三个点 - 使用二次贝塞尔曲线
      else if (remainingPoints === 3) {
        const p0 = points[i]
        const p1 = points[i + 1]
        const p2 = points[i + 2]

        // 选择合适的动量因子
        const momentumFactor = this.lowFPS
          ? this.lowFPSMomentumFactor
          : this.momentumFactor

        // 使用动量控制点计算
        const cp = getMomentumControlPoint(p0, p1, p2, {
          momentumFactor: momentumFactor
        })

        this.ctx.quadraticCurveTo(cp.cx, cp.cy, p2.x, p2.y)
        break
      }
      // 至少四个点 - 可以使用三次贝塞尔曲线
      else {
        const p0 = points[i]
        const p1 = points[i + 1]
        const p2 = points[i + 2]
        const p3 = points[i + 3]

        // 检测是否是急转弯 - 使用Vec2工具简化代码
        const v1 = Vec2.fromPoints(p1, p2)
        const v2 = Vec2.fromPoints(p2, p3)
        const u1 = Vec2.normalize(v1)
        const u2 = Vec2.normalize(v2)
        const dot = Vec2.dot(u1, u2)

        // 检测是否是最后一段（用于特殊终点处理）
        const isLastSegment = i >= points.length - 4

        // 选择合适的动量和曲线因子
        const momentumFactor = this.lowFPS
          ? this.lowFPSMomentumFactor
          : this.momentumFactor
        const curveFactor = this.lowFPS
          ? this.lowFPSCurveFactor
          : this.curveFactor
        const speedThreshold = this.lowFPS ? 15 : 20 // 低帧率时降低速度阈值

        // 急转弯特殊处理
        if (dot < 0) {
          const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
            p0,
            p1,
            p2,
            {
              momentumFactor: momentumFactor,
              speedThreshold: speedThreshold,
              endFactor: 0.2,
              isLastSegment
            }
          )

          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
          i += 2 // 向前推进两个点
        }
        // 常规连续曲线段
        else if (i === 0 || i === points.length - 4) {
          // 第一段或最后一段使用终点段处理
          const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
            p0,
            p1,
            p2,
            {
              momentumFactor: this.lowFPS ? 0.45 : 0.4,
              speedThreshold: speedThreshold,
              endFactor: this.lowFPS ? 0.18 : 0.15,
              isLastSegment // 传递是否是最后一段的标志
            }
          )

          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
          i += 2 // 向前推进两个点
        }
        // 中间段使用四点贝塞尔曲线
        else {
          const { cp1x, cp1y, cp2x, cp2y } = getCubicMomentumControlPoints(
            p0,
            p1,
            p2,
            p3,
            {
              controlFactor: curveFactor,
              speedThreshold: speedThreshold
            }
          )

          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
          i += 2 // 向前推进两个点
        }
      }
    }

    this.ctx.stroke()
  }

  /**
   * 高质量笔画渲染
   *
   * 不进行点采样，使用全部原始点以获得最高质量的渲染效果
   * 适用于性能良好或笔画点数较少的情况
   *
   * @param {Stroke} stroke - 笔画对象
   * @param {Array<{x,y}>} points - 点数组
   * @param {Array<number>} pressures - 压力值数组
   * @private
   */
  _renderHighQualityStroke(stroke, points, pressures) {
    // 高质量模式 - 使用更多的点采样和更平滑的曲线
    if (points.length <= 1) {
      // 单点处理
      if (points.length === 1) {
        this.ctx.beginPath()
        this.ctx.arc(
          points[0].x,
          points[0].y,
          stroke.baseSize * 0.5,
          0,
          Math.PI * 2
        )
        this.ctx.fill()
      }
      return
    }

    // 对于简单的两点情况，直接连线
    if (points.length === 2) {
      this.ctx.beginPath()
      this.ctx.moveTo(points[0].x, points[0].y)
      this.ctx.lineTo(points[1].x, points[1].y)

      const width = stroke.baseSize * (0.5 + (pressures[0] || 0.5))
      this.ctx.lineWidth = width
      this.ctx.stroke()
      return
    }

    // 高质量模式下不进行点采样，使用全部点以获得最平滑的曲线
    this.ctx.beginPath()
    this._renderSmoothedPath(points, pressures, stroke)
  }
}

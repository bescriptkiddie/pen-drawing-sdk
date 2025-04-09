import {
  getMomentumControlPoint,
  getFinalSegmentControlPoints
} from "./SmoothStrategy.js"

export class PreviewRenderer {
  constructor(ctx, options = {}) {
    this.ctx = ctx
    this.minPointsForCurve = 2
    this.smoothSteps = options.smoothSteps ?? 4
    this.lowFPS = options.lowFPS ?? false
    this.lowFPSFilterWindowSize = options.lowFPSFilterWindowSize ?? 3

    // Store default options for high FPS preview
    this.defaultOptions = {
      momentumFactor: options.momentumFactor ?? 0.5, // Default momentum for high FPS preview
      curveFactor: options.curveFactor ?? 0.35, // Default curve factor for high FPS preview
      speedThreshold: options.speedThreshold ?? 25,
      endFactor: options.endFactor ?? 0.15
    }

    // Store specific options for low FPS preview, matching CanvasRenderer's low FPS settings
    this.lowFPSOptions = {
      angleThreshold: options.lowFPSAngleThreshold ?? 0.04,
      distanceThreshold: options.lowFPSDistanceThreshold ?? 4,
      momentumFactor: options.lowFPSMomentumFactor ?? 0.6, // 与CanvasRenderer一致，从0.65改为0.6
      curveFactor: options.lowFPSCurveFactor ?? 0.45,
      maxSkipPoints: options.lowFPSMaxSkipPoints ?? 2,
      speedThreshold: options.lowFPSSpeedThreshold ?? 15, // 与CanvasRenderer一致，从20改为15
      endFactor: options.lowFPSEndFactor ?? 0.18 // 与CanvasRenderer一致，从0.2改为0.18
    }

    // Number of recent points to consider for preview sampling/rendering
    this.previewLookback = options.previewLookback ?? 15
  }

  updateOptions(options = {}) {
    if (options.lowFPS !== undefined) {
      this.lowFPS = options.lowFPS
    }
    if (options.lowFPSFilterWindowSize !== undefined) {
      this.lowFPSFilterWindowSize = options.lowFPSFilterWindowSize
    }
    // Allow updating factors if necessary
  }

  renderPreviewSegment(stroke) {
    const points = stroke.points
    const pressures = stroke.pressures
    if (points.length < 2) return

    this.ctx.save()
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over"

    let pointsToRender = points
    let pressuresToRender = pressures
    const currentOptions = this.lowFPS
      ? this.lowFPSOptions
      : this.defaultOptions

    // 只在低帧率时处理
    if (this.lowFPS && points.length > 10) {
      // 获取最近的点
      const lookback = Math.min(points.length, this.previewLookback)
      const recentPoints = points.slice(-lookback)
      const recentPressures = pressures.slice(-lookback)

      // 1. 添加预平滑处理 - 与CanvasRenderer一致
      const smoothed = this._preSmoothPointsForLowFPS(
        recentPoints,
        recentPressures
      )
      const smoothedPoints = smoothed.points
      const smoothedPressures = smoothed.pressures

      // 2. 采样平滑后的点
      const sampledPoints = this._sampleKeyPoints(
        smoothedPoints,
        currentOptions
      )
      const sampledPressures = this._resamplePressures(
        smoothedPressures,
        smoothedPoints,
        sampledPoints
      )

      pointsToRender = sampledPoints
      pressuresToRender = sampledPressures
    }

    // 获取足够的点来绘制预览曲线
    const numPointsToUse = Math.min(pointsToRender.length, 7)
    if (numPointsToUse < 2) {
      this.ctx.restore()
      return
    }

    const finalPoints = pointsToRender.slice(-numPointsToUse)
    const finalPressures = pressuresToRender.slice(-numPointsToUse)

    this._renderPreviewCurve(
      finalPoints,
      finalPressures,
      stroke,
      currentOptions
    )
    this.ctx.restore()
  }

  /**
   * 低帧率下的点预平滑 - 与CanvasRenderer完全相同的实现
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

  _renderPreviewCurve(points, pressures, stroke, options) {
    // Use last few points for performance
    const numPointsToUse = Math.min(points.length, 7)
    const pointsToUse = points.slice(-numPointsToUse)
    const pressuresToUse = pressures.slice(-numPointsToUse)

    if (pointsToUse.length < 2) return

    this.ctx.beginPath()

    const n = pointsToUse.length
    const p_last = pointsToUse[n - 1]
    const pr_last = pressuresToUse[n - 1] ?? 0.5
    const p_prev = pointsToUse[n - 2]
    const pr_prev = pressuresToUse[n - 2] ?? 0.5

    this.ctx.moveTo(p_prev.x, p_prev.y)

    // Apply Bezier using the 'options' passed in
    if (n === 2) {
      this.ctx.lineTo(p_last.x, p_last.y)
    } else if (n === 3) {
      const p0 = pointsToUse[0]
      const p1 = p_prev
      const p2 = p_last
      // Use quadratic with potentially strong momentumFactor from options
      const cp = getMomentumControlPoint(p0, p1, p2, options)
      this.ctx.quadraticCurveTo(cp.cx, cp.cy, p2.x, p2.y)
    } else {
      // n >= 4
      const p0 = pointsToUse[n - 4] // Point before p1 for context
      const p1 = pointsToUse[n - 3] // Point before start of final curve segment
      const p2 = p_prev // Start of final curve segment
      const p3 = p_last // End of final curve segment

      // 使用与CanvasRenderer一致的参数和策略
      const speedThreshold = this.lowFPS ? 15 : 20 // 低帧率时降低速度阈值
      const finalOptions = {
        ...options,
        speedThreshold: speedThreshold,
        endFactor: this.lowFPS ? 0.18 : 0.15 // 与CanvasRenderer一致
      }

      // Use getFinalSegmentControlPoints, passing the potentially strong low FPS options
      const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
        p1,
        p2,
        p3,
        finalOptions
      )
      this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y)
    }

    // Set line width based on average pressure of the drawn segment
    const avgWidth = stroke.baseSize * (0.5 + (pr_prev + pr_last) / 2)
    this.ctx.lineWidth = Math.max(0.5, avgWidth)
    this.ctx.strokeStyle = stroke.color
    this.ctx.stroke()
  }

  drawStartPoint(pos, tool = "pen", radius = 1.5) {
    this.ctx.save()
    if (tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out"
    }

    this.ctx.beginPath()
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
    this.ctx.fillStyle = tool === "eraser" ? "rgba(0,0,0,1)" : "black"
    this.ctx.fill()
    this.ctx.restore()
  }

  _sampleKeyPoints(points, options) {
    if (points.length <= 3) return [...points]

    const result = [points[0]]
    let lastAddedIndex = 0
    const angleThreshold = options.angleThreshold || 0.04 // 确保与低帧率设置一致
    const distanceThreshold = options.distanceThreshold || 4 // 确保与低帧率设置一致
    const maxSkipPoints = options.maxSkipPoints || 2 // 确保与低帧率设置一致

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

      // 与CanvasRenderer完全一致的自适应阈值计算
      const curvatureAdaptiveThreshold =
        distanceThreshold * (0.2 + 0.8 * Math.min(1, (1 + dotProduct) / 2))

      // 与CanvasRenderer相同的策略
      if (
        angleChange > angleThreshold ||
        distFromLast > curvatureAdaptiveThreshold ||
        i - lastAddedIndex > maxSkipPoints
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

  _resamplePressures(pressures, originalPoints, sampledPoints) {
    if (originalPoints.length !== pressures.length) {
      return sampledPoints.map(() => 0.5)
    }

    const result = []
    let lastFoundIndex = 0
    const searchWindowSize = Math.min(20, Math.ceil(originalPoints.length / 4))

    for (const point of sampledPoints) {
      let minDist = Infinity
      let closestIndex = lastFoundIndex

      const startIdx = Math.max(0, lastFoundIndex - searchWindowSize)
      const endIdx = Math.min(
        originalPoints.length - 1,
        lastFoundIndex + searchWindowSize
      )

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

      if (closestIndex === startIdx || closestIndex === endIdx) {
        const extendedStart = Math.max(0, startIdx - searchWindowSize)
        const extendedEnd = Math.min(
          originalPoints.length - 1,
          endIdx + searchWindowSize
        )

        const searchStart = closestIndex === startIdx ? extendedStart : startIdx
        const searchEnd = closestIndex === endIdx ? extendedEnd : endIdx

        for (let i = searchStart; i <= searchEnd; i++) {
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
}

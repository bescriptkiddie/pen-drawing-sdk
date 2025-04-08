import {
  getQuadraticControlPoints,
  getMomentumControlPoint,
  getCubicMomentumControlPoints,
  getFinalSegmentControlPoints
} from "./SmoothStrategy.js"

export class CanvasRenderer {
  constructor(ctx, dpr = 1, options = {}) {
    this.ctx = ctx
    this.dpr = dpr
    this.minPointsForCurve = 3
    this.lowFPS = options.lowFPS ?? false
    this.smoothSteps = options.smoothSteps ?? 4
    // 增加额外的控制参数以匹配预览渲染的质量
    this.angleThreshold = options.angleThreshold ?? 0.06 // 降低阈值以保留更多角度变化点
    this.distanceThreshold = options.distanceThreshold ?? 6 // 减小距离阈值以保留更多点
    this.momentumFactor = options.momentumFactor ?? 0.5 // 增加贝塞尔曲线的动量因子
    this.curveFactor = options.curveFactor ?? 0.35 // 曲线平滑因子
  }

  clearCanvas(width, height) {
    this.ctx.clearRect(0, 0, width / this.dpr, height / this.dpr)
  }

  renderStrokes(strokes) {
    for (const stroke of strokes) {
      this.renderStroke(stroke)
    }
  }

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

  _renderOptimizedStroke(stroke, points, pressures) {
    // 优化的点采样策略 - 减少过度简化，保留更多关键点
    const simplifiedPoints = this._sampleKeyPoints(points)
    const simplifiedPressures = this._resamplePressures(
      pressures,
      points,
      simplifiedPoints
    )

    // 至少需要2个点才能画线
    if (simplifiedPoints.length < 2) return

    this.ctx.beginPath()
    this._renderSmoothedPath(simplifiedPoints, simplifiedPressures, stroke)
  }

  // 新的点采样算法，更智能地保留关键点
  _sampleKeyPoints(points) {
    if (points.length <= 3) return [...points]

    const result = [points[0]]
    let lastAddedIndex = 0

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
        this.distanceThreshold * (0.2 + 0.8 * Math.min(1, (1 + dotProduct) / 2))

      // 保留点的条件更宽松，确保曲线更平滑
      if (
        angleChange > this.angleThreshold ||
        distFromLast > curvatureAdaptiveThreshold ||
        i - lastAddedIndex > 4 // 最多跳过4个点
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

  // 根据重新采样的点重新计算压力值
  _resamplePressures(pressures, originalPoints, sampledPoints) {
    if (originalPoints.length !== pressures.length) {
      // 压力值和点不匹配时的简单处理
      return sampledPoints.map(() => 0.5)
    }

    const result = []
    for (const point of sampledPoints) {
      // 查找原始点集中最接近的点
      let minDist = Infinity
      let closestIndex = 0

      for (let i = 0; i < originalPoints.length; i++) {
        const dist = Math.sqrt(
          Math.pow(point.x - originalPoints[i].x, 2) +
            Math.pow(point.y - originalPoints[i].y, 2)
        )

        if (dist < minDist) {
          minDist = dist
          closestIndex = i
        }
      }

      result.push(pressures[closestIndex] || 0.5)
    }

    return result
  }

  // 使用平滑贝塞尔曲线绘制路径 - 与预览渲染一致的算法
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

        // 使用动量控制点计算
        const cp = getMomentumControlPoint(p0, p1, p2, {
          momentumFactor: this.momentumFactor
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

        // 检测是否是急转弯
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y }
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001
        const u1 = { x: v1.x / len1, y: v1.y / len1 }
        const u2 = { x: v2.x / len2, y: v2.y / len2 }
        const dot = u1.x * u2.x + u1.y * u2.y

        // 急转弯特殊处理
        if (dot < 0) {
          const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
            p0,
            p1,
            p2,
            {
              momentumFactor: this.momentumFactor,
              speedThreshold: 20,
              endFactor: 0.2
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
              momentumFactor: 0.4,
              speedThreshold: 25,
              endFactor: 0.15
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
              controlFactor: this.curveFactor,
              speedThreshold: 25
            }
          )

          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
          i += 2 // 向前推进两个点
        }
      }
    }

    this.ctx.stroke()
  }

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

import {
  getQuadraticControlPoints,
  getMomentumControlPoint,
  getCubicMomentumControlPoints,
  getFinalSegmentControlPoints
} from "./SmoothStrategy.js"

export class PreviewRenderer {
  constructor(ctx, options = {}) {
    this.ctx = ctx
    this.minPointsForCurve = 3
    this.smoothSteps = options.smoothSteps ?? 4
    this.lowFPS = options.lowFPS ?? false
  }

  renderPreviewSegment(stroke) {
    const points = stroke.points
    const pressures = stroke.pressures
    if (points.length < this.minPointsForCurve) return

    this.ctx.save()
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over"

    // 低帧率模式：使用简化的渲染方式
    if (this.lowFPS) {
      this._renderSimplifiedPreview(points, pressures, stroke)
    } else {
      this._renderDetailedPreview(points, pressures, stroke)
    }

    this.ctx.restore()
  }

  _renderSimplifiedPreview(points, pressures, stroke) {
    // 简化版本但确保与CanvasRenderer._renderLowFPSStroke算法一致
    if (points.length < 3) {
      // 点不足时使用简单线段
      const p1 = points[points.length - 2]
      const p2 = points[points.length - 1]
      const pr2 = pressures[pressures.length - 1] || 0.5

      this.ctx.beginPath()
      this.ctx.moveTo(p1.x, p1.y)
      this.ctx.lineTo(p2.x, p2.y)

      const width = stroke.baseSize * (0.5 + pr2)
      this.ctx.strokeStyle = stroke.color
      this.ctx.lineWidth = width
      this.ctx.stroke()
      return
    }

    // 数据准备 - 获取足够多的点以生成更平滑的曲线
    // 保持与CanvasRenderer一致的点数处理策略
    const numPoints = Math.min(points.length, 7)
    const pointsToUse = points.slice(-numPoints) // 取最后几个点
    const pressuresToUse = pressures.slice(-numPoints)

    this.ctx.beginPath()

    // 如果只有三个点，使用二次贝塞尔曲线 - 与CanvasRenderer一致
    if (pointsToUse.length === 3) {
      const p0 = pointsToUse[0]
      const p1 = pointsToUse[1]
      const p2 = pointsToUse[2]

      // 使用共享的动量控制点计算函数 - 确保参数与CanvasRenderer一致
      const cp = getMomentumControlPoint(p0, p1, p2, {
        momentumFactor: 0.5 // 与CanvasRenderer一致
      })

      this.ctx.moveTo(p1.x, p1.y)
      this.ctx.quadraticCurveTo(cp.cx, cp.cy, p2.x, p2.y)
    }
    // 更多点时使用与CanvasRenderer一致的处理
    else if (pointsToUse.length >= 4) {
      // 获取最后几个点
      const n = pointsToUse.length
      const p0 = pointsToUse[n - 4 >= 0 ? n - 4 : 0]
      const p1 = pointsToUse[n - 3]
      const p2 = pointsToUse[n - 2]
      const p3 = pointsToUse[n - 1]

      // 检测是否是急转弯 - 与CanvasRenderer使用完全相同的检测
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y }
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001
      const u1 = { x: v1.x / len1, y: v1.y / len1 }
      const u2 = { x: v2.x / len2, y: v2.y / len2 }
      const dot = u1.x * u2.x + u1.y * u2.y

      // 使用与CanvasRenderer完全相同的转弯处理逻辑
      this.ctx.moveTo(p2.x, p2.y)

      if (dot < 0) {
        // 转弯角度大于90度
        // 急转弯特殊处理 - 与CanvasRenderer使用相同参数
        const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
          p1,
          p2,
          p3,
          {
            momentumFactor: 0.5, // 与CanvasRenderer一致
            speedThreshold: 20,
            endFactor: 0.2 // 与CanvasRenderer一致
          }
        )

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y)
      } else {
        // 正常曲线 - 与CanvasRenderer使用相同参数
        const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
          p1,
          p2,
          p3,
          {
            momentumFactor: 0.4, // 与CanvasRenderer一致
            speedThreshold: 25,
            endFactor: 0.15 // 与CanvasRenderer一致
          }
        )

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y)
      }
    }

    // 设置线宽和颜色
    const pr1 = pressuresToUse[pressuresToUse.length - 2] || 0.5
    const pr2 = pressuresToUse[pressuresToUse.length - 1] || 0.5
    const avgWidth = stroke.baseSize * (0.5 + (pr1 + pr2) / 2)

    this.ctx.strokeStyle = stroke.color
    this.ctx.lineWidth = avgWidth
    this.ctx.stroke()
  }

  _renderDetailedPreview(points, pressures, stroke) {
    // 高质量渲染方式 - 使用与CanvasRenderer._renderHighQualityStroke一致的算法
    if (points.length < 3) {
      if (points.length === 2) {
        // 只有两个点时使用直线
        const p1 = points[points.length - 2]
        const p2 = points[points.length - 1]
        const pr1 = pressures[pressures.length - 2] || 0.5

        this.ctx.beginPath()
        this.ctx.moveTo(p1.x, p1.y)
        this.ctx.lineTo(p2.x, p2.y)

        const width = stroke.baseSize * (0.5 + pr1)
        this.ctx.strokeStyle = stroke.color
        this.ctx.lineWidth = width
        this.ctx.stroke()
      }
      return
    }

    // 处理最近的几个点
    const n = Math.min(points.length, 5) // 限制处理点数，避免性能问题
    const pointsToUse = points.slice(-n)
    const pressuresToUse = pressures.slice(-n)

    this.ctx.beginPath()

    // 第一个点
    this.ctx.moveTo(pointsToUse[0].x, pointsToUse[0].y)

    // 使用与CanvasRenderer一致的贝塞尔曲线绘制
    for (let i = 1; i < pointsToUse.length - 1; i++) {
      const p0 = i > 1 ? pointsToUse[i - 2] : pointsToUse[i - 1]
      const p1 = pointsToUse[i - 1]
      const p2 = pointsToUse[i]
      const p3 =
        i < pointsToUse.length - 2 ? pointsToUse[i + 1] : pointsToUse[i]

      // 设置线宽
      const pressure = pressuresToUse[i - 1] || 0.5
      const width = stroke.baseSize * (0.5 + pressure)
      this.ctx.lineWidth = width

      // 使用与CanvasRenderer一致的控制点计算
      if (i === 1) {
        // 第一段使用二次贝塞尔曲线
        const cp = getMomentumControlPoint(p0, p1, p2, {
          momentumFactor: 0.4 // 与CanvasRenderer一致
        })
        this.ctx.quadraticCurveTo(cp.cx, cp.cy, p2.x, p2.y)
      } else {
        // 其他段使用三次贝塞尔曲线
        const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
          p0,
          p1,
          p2,
          {
            momentumFactor: 0.4, // 与CanvasRenderer一致
            speedThreshold: 25,
            endFactor: 0.15
          }
        )

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
      }
    }

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
}

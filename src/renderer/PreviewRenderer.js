import {
  getMomentumControlPoint,
  getCubicMomentumControlPoints,
  getFinalSegmentControlPoints
} from "./SmoothStrategy.js"
import { StrokeUtils } from "./StrokeUtils.js"
import { SmoothStrategy } from "./SmoothStrategy.js"

export class PreviewRenderer {
  constructor(ctx, options = {}) {
    this.ctx = ctx
    this.lowFPS = options.lowFPS ?? false
    this.lowFPSFilterWindowSize = options.lowFPSFilterWindowSize ?? 3
    this.previewLookback = options.previewLookback ?? 15
    this.smoothSteps = options.smoothSteps ?? 4 // ⬆ 插值更密集
    this.interpolateInLowFPS = options.interpolateInLowFPS ?? true
    this.maxSegmentLength = options.maxSegmentLength ?? 20 // ⬅ 每段最长长度限制（像素）

    this.defaultOptions = {
      momentumFactor: options.momentumFactor ?? 0.5,
      curveFactor: options.curveFactor ?? 0.35,
      speedThreshold: options.speedThreshold ?? 25,
      endFactor: options.endFactor ?? 0.15
    }

    this.lowFPSOptions = {
      angleThreshold: options.lowFPSAngleThreshold ?? 0.04,
      distanceThreshold: options.lowFPSDistanceThreshold ?? 4,
      momentumFactor: options.lowFPSMomentumFactor ?? 0.6,
      curveFactor: options.lowFPSCurveFactor ?? 0.45,
      maxSkipPoints: options.lowFPSMaxSkipPoints ?? 2,
      speedThreshold: options.lowFPSSpeedThreshold ?? 15,
      endFactor: options.lowFPSEndFactor ?? 0.18
    }
  }

  updateOptions(options = {}) {
    if (options.lowFPS !== undefined) this.lowFPS = options.lowFPS
    if (options.lowFPSFilterWindowSize !== undefined)
      this.lowFPSFilterWindowSize = options.lowFPSFilterWindowSize
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
    const options = this.lowFPS ? this.lowFPSOptions : this.defaultOptions

    if (this.lowFPS && points.length > 10) {
      const lookback = Math.min(points.length, this.previewLookback)
      const recentPoints = points.slice(-lookback)
      const recentPressures = pressures.slice(-lookback)

      const { points: smoothed, pressures: smoothedPressures } =
        StrokeUtils.preSmoothPoints(recentPoints, recentPressures, true)
      const sampled = StrokeUtils.sampleKeyPoints(smoothed, options)
      const resampled = StrokeUtils.resamplePressures(
        smoothedPressures,
        smoothed,
        sampled
      )

      // ⬇ 压力平滑处理（滑动窗口平均）
      const smoothedPressuresFinal = []
      const windowSize = 3
      for (let i = 0; i < resampled.length; i++) {
        let sum = 0
        let count = 0
        for (let j = -1; j <= 1; j++) {
          const idx = i + j
          if (idx >= 0 && idx < resampled.length) {
            sum += resampled[idx]
            count++
          }
        }
        smoothedPressuresFinal.push(sum / count)
      }

      if (this.interpolateInLowFPS) {
        const strategy = new SmoothStrategy({
          enabled: true,
          steps: this.smoothSteps
        })
        const { points: interp, pressures: interpP } = strategy.apply(
          sampled,
          smoothedPressuresFinal
        )
        pointsToRender = interp
        pressuresToRender = interpP
      } else {
        pointsToRender = sampled
        pressuresToRender = smoothedPressuresFinal
      }
    }

    if (pointsToRender.length >= 2) {
      this._renderSmoothedPreviewPath(
        pointsToRender,
        pressuresToRender,
        stroke,
        options
      )
    }

    this.ctx.restore()
  }

  _renderSmoothedPreviewPath(points, pressures, stroke, options) {
    this.ctx.beginPath()
    this.ctx.moveTo(points[0].x, points[0].y)

    for (let i = 0; i < points.length - 1; ) {
      const remaining = points.length - i
      const pressure = pressures[i] || 0.5
      this.ctx.lineWidth = stroke.baseSize * (0.5 + pressure)

      const dx = points[i + 2]?.x - points[i + 1]?.x || 0
      const dy = points[i + 2]?.y - points[i + 1]?.y || 0
      const segLength = Math.sqrt(dx * dx + dy * dy)

      if (remaining === 2 || segLength > this.maxSegmentLength) {
        this.ctx.lineTo(points[i + 1].x, points[i + 1].y)
        i += 1
      } else if (remaining === 3) {
        const cp = getMomentumControlPoint(
          points[i],
          points[i + 1],
          points[i + 2],
          options
        )
        this.ctx.quadraticCurveTo(
          cp.cx,
          cp.cy,
          points[i + 2].x,
          points[i + 2].y
        )
        break
      } else {
        const p0 = points[i]
        const p1 = points[i + 1]
        const p2 = points[i + 2]
        const p3 = points[i + 3]

        const isLast = i >= points.length - 4
        const { cp1x, cp1y, cp2x, cp2y } = isLast
          ? getFinalSegmentControlPoints(p0, p1, p2, {
              ...options,
              isLastSegment: true
            })
          : getCubicMomentumControlPoints(p0, p1, p2, p3, options)

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
        i += 2
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

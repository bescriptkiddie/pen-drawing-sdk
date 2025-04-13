import {
  getQuadraticControlPoints,
  getMomentumControlPoint,
  getCubicMomentumControlPoints,
  getFinalSegmentControlPoints,
  SmoothStrategy
} from "./SmoothStrategy.js"
import { Vec2 } from "../utils/math.js"
import { StrokeUtils } from "./StrokeUtils.js"

export class CanvasRenderer {
  constructor(ctx, dpr = 1, options = {}) {
    this.ctx = ctx
    this.dpr = dpr
    this.lowFPS = options.lowFPS ?? false
    this.smoothSteps = options.smoothSteps ?? 3 // 更平滑的插值步数
    this.angleThreshold = options.angleThreshold ?? 0.06
    this.distanceThreshold = options.distanceThreshold ?? 6
    this.momentumFactor = options.momentumFactor ?? 0.5
    this.curveFactor = options.curveFactor ?? 0.35

    this.lowFPSAngleThreshold = options.lowFPSAngleThreshold ?? 0.035
    this.lowFPSDistanceThreshold = options.lowFPSDistanceThreshold ?? 3
    this.lowFPSMaxSkipPoints = options.lowFPSMaxSkipPoints ?? 1
    this.lowFPSMomentumFactor = options.lowFPSMomentumFactor ?? 0.6
    this.lowFPSCurveFactor = options.lowFPSCurveFactor ?? 0.45

    this.interpolateInLowFPS = options.interpolateInLowFPS ?? true
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

    if (this.lowFPS && points.length > 10) {
      this._renderOptimizedStroke(stroke, points, pressures)
    } else {
      this._renderHighQualityStroke(stroke, points, pressures)
    }

    this.ctx.restore()
  }

  _renderOptimizedStroke(stroke, points, pressures) {
    const { points: smoothedPoints, pressures: smoothedPressures } =
      StrokeUtils.preSmoothPoints(points, pressures, this.lowFPS)

    const sampledPoints = StrokeUtils.sampleKeyPoints(smoothedPoints, {
      angleThreshold: this.lowFPSAngleThreshold,
      distanceThreshold: this.lowFPSDistanceThreshold,
      maxSkipPoints: this.lowFPSMaxSkipPoints
    })

    const sampledPressures = StrokeUtils.resamplePressures(
      smoothedPressures,
      smoothedPoints,
      sampledPoints
    )

    if (sampledPoints.length < 2) return

    let renderPoints = sampledPoints
    let renderPressures = sampledPressures

    if (this.interpolateInLowFPS) {
      const strategy = new SmoothStrategy({
        enabled: true,
        steps: this.smoothSteps
      })
      const result = strategy.apply(sampledPoints, sampledPressures)
      renderPoints = result.points
      renderPressures = result.pressures
    }

    this.ctx.beginPath()
    this._renderSmoothedPath(renderPoints, renderPressures, stroke)
  }

  _renderSmoothedPath(points, pressures, stroke) {
    if (points.length < 2) return

    this.ctx.moveTo(points[0].x, points[0].y)
    const firstPressure = pressures[0] || 0.5
    this.ctx.lineWidth = stroke.baseSize * (0.5 + firstPressure)

    if (points.length === 2) {
      this.ctx.lineTo(points[1].x, points[1].y)
      this.ctx.stroke()
      return
    }

    let i = 0
    while (i < points.length - 1) {
      const remainingPoints = points.length - i
      const pressure = pressures[i] || 0.5
      this.ctx.lineWidth = stroke.baseSize * (0.5 + pressure)

      if (remainingPoints === 2) {
        this.ctx.lineTo(points[i + 1].x, points[i + 1].y)
        break
      } else if (remainingPoints === 3) {
        const cp = getMomentumControlPoint(
          points[i],
          points[i + 1],
          points[i + 2],
          {
            momentumFactor: this.lowFPS
              ? this.lowFPSMomentumFactor
              : this.momentumFactor
          }
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

        const dot = Vec2.dot(
          Vec2.normalize(Vec2.fromPoints(p1, p2)),
          Vec2.normalize(Vec2.fromPoints(p2, p3))
        )

        const isLastSegment = i >= points.length - 4
        const momentumFactor = this.lowFPS
          ? this.lowFPSMomentumFactor
          : this.momentumFactor
        const curveFactor = this.lowFPS
          ? this.lowFPSCurveFactor
          : this.curveFactor
        const speedThreshold = this.lowFPS ? 15 : 20

        if (dot < 0) {
          const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
            p0,
            p1,
            p2,
            {
              momentumFactor,
              speedThreshold,
              endFactor: 0.2,
              isLastSegment
            }
          )
          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
          i += 2
        } else if (i === 0 || i === points.length - 4) {
          const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
            p0,
            p1,
            p2,
            {
              momentumFactor: this.lowFPS ? 0.45 : 0.4,
              speedThreshold,
              endFactor: this.lowFPS ? 0.18 : 0.15,
              isLastSegment
            }
          )
          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
          i += 2
        } else {
          const { cp1x, cp1y, cp2x, cp2y } = getCubicMomentumControlPoints(
            p0,
            p1,
            p2,
            p3,
            {
              controlFactor: curveFactor,
              speedThreshold
            }
          )
          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
          i += 2
        }
      }
    }
    this.ctx.stroke()
  }

  _renderHighQualityStroke(stroke, points, pressures) {
    if (points.length <= 1) return
    if (points.length === 2) {
      this.ctx.beginPath()
      this.ctx.moveTo(points[0].x, points[0].y)
      this.ctx.lineTo(points[1].x, points[1].y)
      this.ctx.lineWidth = stroke.baseSize * (0.5 + (pressures[0] || 0.5))
      this.ctx.stroke()
      return
    }
    this.ctx.beginPath()
    this._renderSmoothedPath(points, pressures, stroke)
  }
}

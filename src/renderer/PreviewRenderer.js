import { getQuadraticControlPoints } from "./SmoothStrategy.js"

export class PreviewRenderer {
  constructor(ctx) {
    this.ctx = ctx
    this.minPointsForCurve = 3
  }

  renderPreviewSegment(stroke) {
    const points = stroke.points
    const pressures = stroke.pressures
    if (points.length < this.minPointsForCurve) return

    const p0 = points[points.length - 3]
    const p1 = points[points.length - 2]
    const p2 = points[points.length - 1]
    const pr1 = pressures[pressures.length - 2] || 0.5
    const pr2 = pressures[pressures.length - 1] || 0.5

    const cp = getQuadraticControlPoints(p0, p1, p2)

    this.ctx.save()
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over"

    // 连续预览路径，而非虚线段
    this.ctx.beginPath()
    this.ctx.moveTo(p0.x, p0.y)
    this.ctx.quadraticCurveTo(cp.cx, cp.cy, p1.x, p1.y)
    this.ctx.quadraticCurveTo((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, p2.x, p2.y)

    const avgWidth = stroke.baseSize * (0.5 + (pr1 + pr2) / 2)
    this.ctx.strokeStyle = stroke.color
    this.ctx.lineWidth = avgWidth
    this.ctx.stroke()

    this.ctx.restore()
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

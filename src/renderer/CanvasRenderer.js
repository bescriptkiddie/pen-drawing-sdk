// src/renderer/CanvasRenderer.js

import { SmoothStrategy, getQuadraticControlPoints } from "./SmoothStrategy.js"
/**
 * CanvasRenderer：处理画布清空与平滑渲染
 */
export class CanvasRenderer {
  /**
   * @param {CanvasRenderingContext2D} ctx - canvas 的绘图上下文
   * @param {number} dpr - 设备像素比（用于缩放）
   * @param {Object} options
   * @param {boolean} options.enableSmoothing - 是否开启插值平滑
   * @param {number} options.smoothSteps - 插值精度（点数）
   */
  constructor(ctx, dpr = 1, options = {}) {
    this.ctx = ctx
    this.dpr = dpr
    this.smoothStrategy = new SmoothStrategy({
      enabled: options.enableSmoothing ?? true,
      steps: options.smoothSteps ?? 4
    })
  }

  /**
   * 清空整个画布区域
   * @param {number} width
   * @param {number} height
   */
  clearCanvas(width, height) {
    this.ctx.clearRect(0, 0, width / this.dpr, height / this.dpr)
  }

  /**
   * 渲染所有笔画
   * @param {Array<Stroke>} strokes
   */
  renderStrokes(strokes) {
    for (const stroke of strokes) {
      this.renderStroke(stroke)
    }
  }

  /**
   * 渲染单条笔画（自动平滑）
   * @param {Stroke} stroke
   */
  renderStroke(stroke) {
    const rawPoints = stroke.points
    if (rawPoints.length < 2) return

    // 平滑路径（不影响原始数据）
    const { points, pressures } = this.smoothStrategy.apply(
      stroke.points,
      stroke.pressures
    )

    this.ctx.save()
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over"

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1]
      const p2 = points[i]
      const pr1 = pressures[i - 1] || 0.5
      const pr2 = pressures[i] || 0.5

      const width1 = stroke.baseSize * (0.5 + pr1)
      const width2 = stroke.baseSize * (0.5 + pr2)

      this._drawLineWithPressure(p1, p2, width1, width2, stroke.color)
    }

    this.ctx.restore()
  }

  /**
   * 实际绘制单条线段（可支持压力）
   * @param {{x, y}} p1
   * @param {{x, y}} p2
   * @param {number} width1
   * @param {number} width2
   * @param {string} color
   */
  _drawLineWithPressure(p1, p2, width1, width2, color) {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.strokeStyle = color
    ctx.lineWidth = (width1 + width2) / 2
    ctx.stroke()
  }

  /**
   * 更新平滑策略开关
   * @param {boolean} enabled
   */
  setSmoothing(enabled) {
    this.smoothStrategy.enabled = enabled
  }
}

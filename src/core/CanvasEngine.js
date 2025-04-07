// src/core/CanvasEngine.js

/**
 * CanvasEngine
 * 提供画布初始化和核心画布操作功能
 */
export class CanvasEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement
    this.ctx = canvasElement.getContext("2d")
    this.dpr = window.devicePixelRatio || 1

    this.initializeCanvasSize()
    window.addEventListener("resize", this.initializeCanvasSize.bind(this))
  }

  /**
   * 初始化画布尺寸，并考虑高DPI屏幕
   */
  initializeCanvasSize() {
    const { width, height } = this.canvas.getBoundingClientRect()
    this.canvas.width = width * this.dpr
    this.canvas.height = height * this.dpr
    this.ctx.scale(this.dpr, this.dpr)
  }

  /**
   * 获取2D绘图上下文
   * @returns {CanvasRenderingContext2D}
   */
  getContext() {
    return this.ctx
  }
}

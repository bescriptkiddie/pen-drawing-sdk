// src/logger/PerformanceMonitor.js

/**
 * PerformanceMonitor：记录绘图相关性能指标
 */
export class PerformanceMonitor {
  constructor(logger = null) {
    this.logger = logger
    this.frameRates = []
    this.renderTimes = []
    this.droppedFrames = 0
    this._frameCount = 0
    this._lastFrameTime = performance.now()
    this._active = false
  }

  /**
   * 启动帧率监控（每秒更新一次）
   */
  start() {
    if (this._active) return
    this._active = true

    const loop = () => {
      const now = performance.now()
      const delta = now - this._lastFrameTime
      this._frameCount++

      if (delta >= 1000) {
        const fps = Math.round((this._frameCount * 1000) / delta)
        this.frameRates.push(fps)
        if (fps < 30) {
          this.droppedFrames++
          this.logger?.warn("低帧率检测", { fps })
        }
        this._frameCount = 0
        this._lastFrameTime = now
      }

      if (this._active) {
        requestAnimationFrame(loop)
      }
    }

    requestAnimationFrame(loop)
  }

  /**
   * 停止监控
   */
  stop() {
    this._active = false
  }

  /**
   * 手动记录一次渲染耗时
   * @param {function} renderFn - 执行渲染的函数
   */
  measureRender(renderFn) {
    const start = performance.now()
    renderFn()
    const end = performance.now()
    const duration = end - start
    this.renderTimes.push(duration)

    if (duration > 33) {
      this.logger?.warn("渲染延迟过高", { duration })
    }
  }

  /**
   * 导出分析数据
   */
  exportMetrics() {
    return {
      frameRates: this.frameRates,
      renderTimes: this.renderTimes,
      droppedFrames: this.droppedFrames,
      avgFps:
        this.frameRates.length > 0
          ? this.frameRates.reduce((a, b) => a + b) / this.frameRates.length
          : 0,
      avgRender:
        this.renderTimes.length > 0
          ? this.renderTimes.reduce((a, b) => a + b) / this.renderTimes.length
          : 0
    }
  }
}

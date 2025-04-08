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
    this._fpsCallbacks = []
    this._lastFpsCheck = 0
    this._checkInterval = 2000
    this._currentFps = 60
  }

  /**
   * 注册FPS变化的回调函数
   * @param {function} callback - 当FPS变化时调用的回调，参数为当前FPS
   */
  onFpsChange(callback) {
    if (typeof callback === "function") {
      this._fpsCallbacks.push(callback)
    }
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
        this._currentFps = fps

        if (fps < 30) {
          this.droppedFrames++
          this.logger?.warn("低帧率检测", { fps })
        }

        if (now - this._lastFpsCheck > this._checkInterval) {
          this._lastFpsCheck = now
          this._notifyFpsCallbacks(fps)
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
   * 通知所有FPS变化回调
   * @private
   */
  _notifyFpsCallbacks(fps) {
    for (const callback of this._fpsCallbacks) {
      try {
        callback(fps)
      } catch (e) {
        this.logger?.error("FPS回调异常", e)
      }
    }
  }

  /**
   * 获取当前估计的FPS
   */
  getCurrentFps() {
    return this._currentFps
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

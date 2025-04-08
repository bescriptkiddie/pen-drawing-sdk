// src/index.js

import { Stroke } from "./tools/Stroke.js"
import { ToolManager } from "./tools/ToolManager.js"
import { PointerInputHandler } from "./input/PointerInputHandler.js"
import { StylusAdapter } from "./input/StylusAdapter.js"
import { CanvasRenderer } from "./renderer/CanvasRenderer.js"
import { PreviewRenderer } from "./renderer/PreviewRenderer.js"
import { Logger } from "./logger/Logger.js"
import { PerformanceMonitor } from "./logger/PerformanceMonitor.js"
import { StrokeAnalytics } from "./logger/StrokeAnalytics.js"
import { PathSmoother } from "./utils/PathSmoother.js"
import { bindUIEvents } from "./ui/UIEventBinder.js"
import {
  getDevicePixelRatio,
  measureDevicePerformance
} from "./utils/device.js"
/**
 * 主类：组合所有子模块
 */
class DrawingBoard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId)
    this.ctx = this.canvas.getContext("2d")
    this.dpr = getDevicePixelRatio()
    this.canvas.width = this.canvas.clientWidth * this.dpr
    this.canvas.height = this.canvas.clientHeight * this.dpr
    this.ctx.scale(this.dpr, this.dpr)

    // 初始化模块
    this.logger = new Logger("DrawingBoard", "info")
    this.toolManager = new ToolManager()
    this.stylusAdapter = new StylusAdapter()
    this.renderer = new CanvasRenderer(this.ctx, this.dpr)
    this.preview = new PreviewRenderer(this.ctx)
    this.monitor = new PerformanceMonitor(this.logger)
    this.analytics = new StrokeAnalytics(this.logger)

    this.strokes = []
    this.history = []
    this.historyIndex = -1
    this.currentStroke = null

    // 添加帧率控制相关属性
    this._isSimulatingLowFPS = false
    this._lastFrameTime = 0
    this._targetFPS = 60 // 默认目标帧率
    this._frameDuration = 1000 / this._targetFPS

    // 添加轨迹平滑器
    this.smoother = new PathSmoother({
      factor: 0.3,
      historySize: 3,
      enabled: true
    })

    this.inputHandler = new PointerInputHandler(this.canvas, (e) =>
      this.stylusAdapter.mapPressure(e)
    )

    this._bindEvents()
    this.monitor.start()
    this._initRendererAndUI()

    this.canvasId = canvasId
    this.inputMode = "pen"
    this._initRendererAndUI()
  }

  async _initRendererAndUI() {
    const { score } = await measureDevicePerformance()
    const fps = this.monitor?.exportMetrics?.().avgFps || 60

    this.lowPerformance = score < 0.6 || fps < 30
    this.logger?.info?.("性能评分", { score, fps })

    const smoothSteps = fps < 30 ? 2 : 4

    this.renderer = new CanvasRenderer(this.ctx, this.dpr, {
      lowFPS: this.lowPerformance,
      smoothSteps
    })

    this.preview = new PreviewRenderer(this.ctx, {
      lowFPS: this.lowPerformance,
      smoothSteps
    })

    // 监控FPS变化，动态调整渲染质量
    this.monitor.onFpsChange((currentFps) => {
      if (currentFps < 28 && !this.lowPerformance) {
        this.lowPerformance = true
        this.logger?.info("自动切换到低帧率模式", { fps: currentFps })

        // 动态更新渲染器设置
        this.renderer.lowFPS = true
        this.preview.lowFPS = true
        this.preview.smoothSteps = 2
        this.renderer.smoothSteps = 2
      } else if (currentFps > 45 && this.lowPerformance) {
        // 如果性能恢复，切回高质量模式
        this.lowPerformance = false
        this.logger?.info("恢复正常渲染模式", { fps: currentFps })

        // 动态更新渲染器设置
        this.renderer.lowFPS = false
        this.preview.lowFPS = false
        this.preview.smoothSteps = 4
        this.renderer.smoothSteps = 4
      }
    })

    this.stylusProfile = "default"
    this.setStylusProfile = (name) => {
      this.stylusProfile = name
      this.stylusAdapter?.useProfile?.(name)
    }

    // 🛠 Debug 日志输出 pointer event
    this._debugEvent = (e) => {
      console.log("PointerEvent:", {
        type: e.type,
        pointerType: e.pointerType,
        pressure: e.pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        x: e.clientX,
        y: e.clientY
      })
    }

    const originalDown = this._onPointerDown?.bind(this)
    this._onPointerDown = (e) => {
      this._debugEvent(e)
      if (this.inputMode === "pen" && e.pointerType !== "pen") return
      const pressure = e.pressure > 0 ? e.pressure : 0.5
      e._patchedPressure = pressure
      originalDown?.(e)
    }

    this._bindEvents()
    this.monitor?.start?.()
    bindUIEvents({ drawingBoard: this })
    this.logger?.info?.("初始化完成")
  }

  _bindEvents() {
    this.inputHandler.bindEvents({
      onPointerDown: this._onPointerDown.bind(this),
      onPointerMove: this._onPointerMove.bind(this),
      onPointerUp: this._onPointerUp.bind(this)
    })

    bindUIEvents({ drawingBoard: this })
  }

  _onPointerDown(event) {
    const pos = this.inputHandler.getPointerPosition(
      event.clientX,
      event.clientY
    )
    const pressure = this.stylusAdapter.mapPressure(event)

    // 重置平滑器状态
    this.smoother.reset()

    // 第一个点不平滑，直接使用
    const tool = this.toolManager.getCurrentTool()
    const size = this.toolManager.getToolSize()
    this.currentStroke = new Stroke(tool, pos, pressure, size)

    this.preview.drawStartPoint(pos, tool, size / 2)
  }

  _onPointerMove(event) {
    if (!this.currentStroke) return

    // 如果正在模拟低帧率，限制处理频率
    if (this._isSimulatingLowFPS) {
      const now = performance.now()
      const elapsed = now - this._lastFrameTime

      if (elapsed < this._frameDuration) {
        return // 跳过此次处理，限制帧率
      }

      this._lastFrameTime = now
    }

    const pos = this.inputHandler.getPointerPosition(
      event.clientX,
      event.clientY
    )

    // 应用平滑策略，低性能模式下使用更强的平滑
    let smoothedPos
    if (this.lowPerformance) {
      // 低帧率模式：多次平滑以获得更平滑的曲线
      const firstSmooth = this.smoother.smooth(pos)
      const secondSmooth = this.smoother.smooth(firstSmooth)
      smoothedPos = {
        x: (firstSmooth.x + secondSmooth.x) / 2,
        y: (firstSmooth.y + secondSmooth.y) / 2
      }
    } else {
      // 正常模式：单次平滑
      smoothedPos = this.smoother.smooth(pos)
    }

    const pressure = this.stylusAdapter.mapPressure(event)
    this.currentStroke.addPoint(smoothedPos, pressure)

    this.preview.renderPreviewSegment(this.currentStroke)
  }

  _onPointerUp() {
    if (this.currentStroke?.isValid()) {
      this.strokes.push(this.currentStroke)
      this._saveToHistory()
      this.analytics.track(this.currentStroke)
      this.monitor.measureRender(() => {
        this.renderer.clearCanvas(this.canvas.width, this.canvas.height)
        this.renderer.renderStrokes(this.strokes)
      })
    }
    this.currentStroke = null
  }

  _saveToHistory() {
    const copy = this.strokes.map((s) => s.clone())
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1)
    }
    this.history.push(copy)
    this.historyIndex = this.history.length - 1
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--
      this.strokes = this.history[this.historyIndex].map((s) => s.clone())
      this.renderer.clearCanvas(this.canvas.width, this.canvas.height)
      this.renderer.renderStrokes(this.strokes)
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      this.strokes = this.history[this.historyIndex].map((s) => s.clone())
      this.renderer.clearCanvas(this.canvas.width, this.canvas.height)
      this.renderer.renderStrokes(this.strokes)
    }
  }

  clear() {
    this.strokes = []
    this._saveToHistory()
    this.renderer.clearCanvas(this.canvas.width, this.canvas.height)
  }

  setTool(tool) {
    this.toolManager.setTool(tool)
  }

  setToolSize(size) {
    this.toolManager.setToolSize(size)
  }

  getToolSize() {
    return this.toolManager.getToolSize()
  }

  toggleInputMode() {
    this.inputMode = this.inputMode === "pen" ? "mouse" : "pen"
    return this.inputMode
  }

  exportLogs() {
    const data = {
      strokes: this.strokes,
      metrics: this.monitor.exportMetrics(),
      behavior: this.analytics.exportStats()
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = `drawing-log-${Date.now()}.json`
    a.click()

    URL.revokeObjectURL(url)
    return data
  }

  exportDetailedAnalysis() {
    return {
      ...this.monitor.exportMetrics(),
      ...this.analytics.exportStats()
    }
  }

  // 模拟低帧率模式
  simulateLowFPS(enable) {
    this._isSimulatingLowFPS = enable
    this._targetFPS = enable ? 24 : 60 // 模拟24FPS的低帧率
    this._frameDuration = 1000 / this._targetFPS

    // 直接更新渲染器设置
    if (enable) {
      this.lowPerformance = true
      this.logger?.info("已启用低帧率模式模拟", { targetFPS: this._targetFPS })

      // 更新渲染器设置
      this.renderer.lowFPS = true
      this.preview.lowFPS = true
      this.preview.smoothSteps = 2
      this.renderer.smoothSteps = 2

      // 增强平滑效果
      this.smoother.setOptions({
        factor: 0.7, // 提高平滑因子
        historySize: 6, // 增加历史点数量
        enabled: true,
        velocitySmoothing: true, // 启用速度感知平滑
        jitterThreshold: 2.5 // 抖动检测阈值
      })
    } else {
      this.lowPerformance = false
      this.logger?.info("已禁用低帧率模式模拟")

      // 恢复渲染器设置
      this.renderer.lowFPS = false
      this.preview.lowFPS = false
      this.preview.smoothSteps = 4
      this.renderer.smoothSteps = 4

      // 恢复默认平滑设置
      this.smoother.setOptions({
        factor: 0.3,
        historySize: 3,
        enabled: true,
        velocitySmoothing: false,
        jitterThreshold: 2.0
      })
    }
  }
}

// 自动挂载（示例）
window.drawingBoard = new DrawingBoard("drawing-board")

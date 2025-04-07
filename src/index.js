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
import { bindUIEvents } from "./ui/UIEventBinder.js"
import { getDevicePixelRatio } from "./utils/device.js"

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

    this.inputHandler = new PointerInputHandler(this.canvas, (e) =>
      this.stylusAdapter.mapPressure(e)
    )

    this._bindEvents()
    this.monitor.start()
    this.logger.info("初始化完成")
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

    const tool = this.toolManager.getCurrentTool()
    const size = this.toolManager.getToolSize()
    this.currentStroke = new Stroke(tool, pos, pressure, size)

    this.preview.drawStartPoint(pos, tool, size / 2)
  }

  _onPointerMove(event) {
    if (!this.currentStroke) return

    const pos = this.inputHandler.getPointerPosition(
      event.clientX,
      event.clientY
    )
    const pressure = this.stylusAdapter.mapPressure(event)
    this.currentStroke.addPoint(pos, pressure)

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
}

// 自动挂载（示例）
window.drawingBoard = new DrawingBoard("drawing-board")

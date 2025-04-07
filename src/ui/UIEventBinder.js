// src/ui/UIEventBinder.js

/**
 * 绑定 UI 控件事件（按钮 / 滑块 / 模式切换等）
 * @param {Object} opts
 * @param {Object} opts.drawingBoard - 主绘图实例
 * @param {HTMLElement} opts.container - 事件绑定容器（默认 document）
 */
export function bindUIEvents({ drawingBoard, container = document }) {
  const tools = ["pen", "eraser", "chalk"]

  tools.forEach((tool) => {
    const btn = container.getElementById(`${tool}-tool`)
    if (btn) {
      btn.addEventListener("click", () => {
        drawingBoard.setTool(tool)
        updateSlider()
      })
    }
  })

  const undoBtn = container.getElementById("undo")
  undoBtn?.addEventListener("click", () => drawingBoard.undo())

  const redoBtn = container.getElementById("redo")
  redoBtn?.addEventListener("click", () => drawingBoard.redo())

  const clearBtn = container.getElementById("clear")
  clearBtn?.addEventListener("click", () => drawingBoard.clear())

  const exportLogsBtn = container.getElementById("export-logs")
  exportLogsBtn?.addEventListener("click", () => drawingBoard.exportLogs())

  const modeBtn = container.getElementById("input-mode-toggle")
  const modeText = container.getElementById("input-mode-text")
  if (modeBtn && modeText) {
    modeBtn.addEventListener("click", () => {
      const mode = drawingBoard.toggleInputMode()
      modeText.textContent = mode === "pen" ? "触控笔模式" : "鼠标模式"
    })
  }

  const sizeSlider = container.getElementById("size-slider")
  const sizeValue = container.getElementById("size-value")
  if (sizeSlider && sizeValue) {
    sizeSlider.addEventListener("input", () => {
      const size = parseInt(sizeSlider.value)
      sizeValue.textContent = size
      drawingBoard.setToolSize(size)
    })

    const updateSlider = () => {
      const size = drawingBoard.getToolSize()
      sizeSlider.value = size
      sizeValue.textContent = size
    }

    updateSlider()
    tools.forEach((tool) => {
      const btn = container.getElementById(`${tool}-tool`)
      btn?.addEventListener("click", updateSlider)
    })
  }

  const exportAnalysisBtn = container.getElementById("export-analysis")
  exportAnalysisBtn?.addEventListener("click", () => {
    const report = drawingBoard.exportDetailedAnalysis?.()
    if (report) {
      const json = JSON.stringify(report, null, 2)
      const blob = new Blob([json], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = `drawing-analysis-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.json`
      a.click()

      URL.revokeObjectURL(url)
    }
  })
}

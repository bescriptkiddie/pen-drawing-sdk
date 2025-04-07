// src/tools/ToolManager.js

/**
 * 工具管理器：用于管理当前工具类型、默认尺寸、自定义尺寸。
 */
export class ToolManager {
  constructor() {
    this.currentTool = "pen"

    this.defaultSizes = {
      pen: 3,
      chalk: 5,
      eraser: 20
    }

    this.customSizes = {
      pen: 3,
      chalk: 5,
      eraser: 20
    }
  }

  /**
   * 设置当前工具类型
   * @param {string} tool - 工具名："pen" | "chalk" | "eraser"
   */
  setTool(tool) {
    if (["pen", "chalk", "eraser"].includes(tool)) {
      this.currentTool = tool
    } else {
      console.warn(`未知工具类型: ${tool}`)
    }
  }

  /**
   * 获取当前或指定工具的尺寸
   * @param {string} [tool] - 可选，指定工具名
   * @returns {number}
   */
  getToolSize(tool) {
    tool = tool || this.currentTool

    if (this.customSizes?.[tool] !== undefined) {
      return this.customSizes[tool]
    }

    return this.defaultSizes[tool] || 3
  }

  /**
   * 设置工具的自定义大小
   * @param {number} size - 新的尺寸值
   * @param {string} [tool] - 可选，指定工具名
   * @returns {boolean} 是否设置成功
   */
  setToolSize(size, tool) {
    tool = tool || this.currentTool
    const parsed = parseFloat(size)

    if (!isNaN(parsed) && parsed > 0) {
      this.customSizes[tool] = parsed
      return true
    }

    return false
  }

  /**
   * 获取当前工具名
   * @returns {string}
   */
  getCurrentTool() {
    return this.currentTool
  }
}

// src/tools/Stroke.js

/**
 * 描述一个笔画的类，包含点、压力、工具、颜色、粗细等信息。
 */
export class Stroke {
  /**
   * 创建一个新的笔画
   * @param {string} tool - 工具类型，例如 'pen'、'eraser'、'chalk'
   * @param {Object} startPoint - 起始点位置，格式为 {x, y}
   * @param {number} pressure - 起始压力值，0~1之间
   * @param {number} baseSize - 工具的基础大小
   */
  constructor(tool, startPoint, pressure = 0.5, baseSize = 3) {
    this.tool = tool
    this.points = [startPoint]
    this.pressures = [pressure]
    this.color = tool === "eraser" ? "white" : "black"
    this.width = baseSize
    this.baseSize = baseSize
    this.timestamp = Date.now()
  }

  /**
   * 添加一个点到笔画中
   * @param {Object} point - 格式为 {x, y}
   * @param {number} pressure - 当前压力值
   */
  addPoint(point, pressure = 0.5) {
    this.points.push(point)
    this.pressures.push(pressure)
  }

  /**
   * 判断该笔画是否有效（至少有两个点）
   * @returns {boolean}
   */
  isValid() {
    return this.points.length >= 2
  }

  /**
   * 获取笔画的包围盒，用于优化渲染
   * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
   */
  getBoundingBox() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (const point of this.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
    return { minX, minY, maxX, maxY }
  }

  /**
   * 克隆当前笔画（用于历史记录）
   * @returns {Stroke}
   */
  clone() {
    const clone = new Stroke(
      this.tool,
      this.points[0],
      this.pressures[0],
      this.baseSize
    )
    clone.points = [...this.points]
    clone.pressures = [...this.pressures]
    clone.color = this.color
    clone.width = this.width
    clone.timestamp = this.timestamp
    return clone
  }
}

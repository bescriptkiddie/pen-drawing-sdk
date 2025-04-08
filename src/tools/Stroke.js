// src/tools/Stroke.js

/**
 * Stroke类：表示一个完整的笔画
 *
 * 这个类用于存储和管理用户绘制的单个笔画，包含了：
 * - 点坐标序列
 * - 每个点的压力值
 * - 工具类型（如：笔、橡皮擦等）
 * - 笔画颜色和宽度信息
 * - 时间戳
 *
 * 它提供了添加点、检查有效性、获取边界框和克隆等功能。
 */
export class Stroke {
  /**
   * 创建一个新的笔画对象
   *
   * @param {string} tool - 工具类型，例如 'pen'、'eraser'、'chalk'等
   * @param {Object} startPoint - 起始点位置，格式为 {x, y}
   * @param {number} pressure - 起始压力值，范围0~1之间
   * @param {number} baseSize - 工具的基础大小/宽度
   */
  constructor(tool, startPoint, pressure = 0.5, baseSize = 3) {
    this.tool = tool
    this.points = [startPoint] // 存储所有点坐标的数组
    this.pressures = [pressure] // 存储每个点对应的压力值
    this.color = tool === "eraser" ? "white" : "black" // 根据工具类型设置颜色
    this.width = baseSize // 当前宽度
    this.baseSize = baseSize // 基础宽度（不受压力影响的部分）
    this.timestamp = Date.now() // 创建时间戳，用于历史记录
  }

  /**
   * 添加一个点到笔画中
   *
   * 当用户移动指针时，新的点会被添加到笔画中，形成连续的路径
   *
   * @param {Object} point - 格式为 {x, y} 的点坐标
   * @param {number} pressure - 当前点的压力值，范围0~1
   */
  addPoint(point, pressure = 0.5) {
    this.points.push(point)
    this.pressures.push(pressure)
  }

  /**
   * 判断该笔画是否有效
   *
   * 有效的笔画至少需要两个点才能形成一条线段
   * 这个方法用于过滤掉无效的（例如单击但未移动形成的）笔画
   *
   * @returns {boolean} 如果笔画有效（包含至少两个点）则返回true
   */
  isValid() {
    return this.points.length >= 2
  }

  /**
   * 获取笔画的包围盒
   *
   * 计算包含整个笔画的最小矩形区域，这对于：
   * - 优化渲染（只重绘包含笔画的区域）
   * - 选择工具
   * - 碰撞检测
   * 等功能非常有用
   *
   * @returns {{minX: number, minY: number, maxX: number, maxY: number}} 包围盒坐标
   */
  getBoundingBox() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity

    // 遍历所有点找出最小和最大的X、Y坐标
    for (const point of this.points) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }

    return { minX, minY, maxX, maxY }
  }

  /**
   * 克隆当前笔画
   *
   * 创建一个当前笔画的深拷贝，常用于：
   * - 历史记录功能（撤销/重做）
   * - 临时修改而不影响原始笔画
   *
   * @returns {Stroke} 当前笔画的完整克隆
   */
  clone() {
    const clone = new Stroke(
      this.tool,
      this.points[0],
      this.pressures[0],
      this.baseSize
    )
    // 深拷贝所有属性
    clone.points = [...this.points]
    clone.pressures = [...this.pressures]
    clone.color = this.color
    clone.width = this.width
    clone.timestamp = this.timestamp
    return clone
  }
}

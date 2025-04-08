/**
 * 轨迹平滑器：用于平滑输入点，减少抖动
 */
export class PathSmoother {
  constructor(options = {}) {
    // 平滑因子，值越大平滑效果越强（0-1之间）
    this.factor = options.factor || 0.5
    // 是否启用平滑
    this.enabled = options.enabled !== false
    // 最近的点记录，用于计算平滑
    this.lastPoints = []
    // 历史点的保留数量
    this.historySize = options.historySize || 4
    // 速度平滑
    this.velocitySmoothing = options.velocitySmoothing || false
    // 抖动阈值
    this.jitterThreshold = options.jitterThreshold || 2.0
    // 上一次处理时间
    this._lastTime = 0
    // 速度历史
    this._velocities = []
  }

  /**
   * 平滑一个输入点
   * @param {Object} point - 输入点 {x, y}
   * @returns {Object} 平滑后的点 {x, y}
   */
  smooth(point) {
    if (!this.enabled) {
      return point
    }

    // 初始状态下记录点并返回
    if (this.lastPoints.length === 0) {
      this.lastPoints.push({ ...point, timestamp: Date.now() })
      this._lastTime = Date.now()
      return point
    }

    const now = Date.now()
    const deltaTime = Math.max(1, now - this._lastTime)
    this._lastTime = now

    const lastPoint = this.lastPoints[this.lastPoints.length - 1]

    // 抖动检测和过滤
    if (this.lastPoints.length >= 2) {
      const dx = point.x - lastPoint.x
      const dy = point.y - lastPoint.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      // 计算速度 (像素/毫秒)
      const velocity = dist / deltaTime
      this._velocities.push(velocity)

      // 保持速度历史长度
      if (this._velocities.length > 3) {
        this._velocities.shift()
      }

      // 计算平均速度
      const avgVelocity =
        this._velocities.reduce((a, b) => a + b, 0) / this._velocities.length

      // 如果是快速移动，减少平滑强度
      if (avgVelocity > 0.5) {
        // 根据速度动态调整平滑因子
        const dynamicFactor = Math.max(0.1, this.factor - avgVelocity * 0.3)
        const smoothedPoint = {
          x: lastPoint.x * dynamicFactor + point.x * (1 - dynamicFactor),
          y: lastPoint.y * dynamicFactor + point.y * (1 - dynamicFactor),
          timestamp: now
        }

        this.lastPoints.push(smoothedPoint)
        if (this.lastPoints.length > this.historySize) {
          this.lastPoints.shift()
        }

        return smoothedPoint
      }

      // 检测抖动 - 如果移动距离很小且点集中
      if (dist < this.jitterThreshold && this.lastPoints.length >= 3) {
        const prevPoint = this.lastPoints[this.lastPoints.length - 2]
        const dx2 = lastPoint.x - prevPoint.x
        const dy2 = lastPoint.y - prevPoint.y
        const prevDist = Math.sqrt(dx2 * dx2 + dy2 * dy2)

        // 如果前后两段移动方向相反且都很小，可能是抖动
        const dotProduct = (dx * dx2 + dy * dy2) / (dist * prevDist || 1)

        if (
          dist < this.jitterThreshold / 2 &&
          prevDist < this.jitterThreshold / 2 &&
          dotProduct < 0
        ) {
          // 检测到抖动，增强平滑力度
          const antiJitterFactor = Math.min(0.9, this.factor + 0.3)
          const smoothedPoint = {
            x:
              lastPoint.x * antiJitterFactor + point.x * (1 - antiJitterFactor),
            y:
              lastPoint.y * antiJitterFactor + point.y * (1 - antiJitterFactor),
            timestamp: now
          }

          this.lastPoints.push(smoothedPoint)
          if (this.lastPoints.length > this.historySize) {
            this.lastPoints.shift()
          }

          return smoothedPoint
        }
      }
    }

    // 标准情况下的平滑
    // 使用当前点和历史点的加权平均
    const smoothedPoint = {
      x: lastPoint.x * this.factor + point.x * (1 - this.factor),
      y: lastPoint.y * this.factor + point.y * (1 - this.factor),
      timestamp: now
    }

    // 记录点历史
    this.lastPoints.push(smoothedPoint)
    if (this.lastPoints.length > this.historySize) {
      this.lastPoints.shift()
    }

    return smoothedPoint
  }

  /**
   * 重置平滑器状态
   */
  reset() {
    this.lastPoints = []
    this._velocities = []
    this._lastTime = 0
  }

  /**
   * 设置平滑参数
   */
  setOptions(options = {}) {
    if (options.factor !== undefined) this.factor = options.factor
    if (options.enabled !== undefined) this.enabled = options.enabled
    if (options.historySize !== undefined)
      this.historySize = options.historySize
    if (options.velocitySmoothing !== undefined)
      this.velocitySmoothing = options.velocitySmoothing
    if (options.jitterThreshold !== undefined)
      this.jitterThreshold = options.jitterThreshold
  }
}

/**
 * 轨迹平滑器（PathSmoother）
 *
 * 用于实时平滑输入点，减少手部抖动和设备噪声的影响，使绘制的线条更加平滑自然。
 * 该平滑器在用户绘制过程中实时处理每个输入点，而不是在完成笔画后再处理。
 *
 * 主要功能：
 * 1. 基于历史点的加权平均进行平滑
 * 2. 速度感知平滑（快速移动时减少平滑强度）
 * 3. 抖动检测和消除
 * 4. 动态调整平滑参数
 */
export class PathSmoother {
  /**
   * 创建一个轨迹平滑器实例
   *
   * @param {Object} options - 平滑器配置选项
   * @param {number} [options.factor=0.5] - 平滑因子（0-1之间），值越大平滑效果越强，但响应越滞后
   * @param {boolean} [options.enabled=true] - 是否启用平滑
   * @param {number} [options.historySize=4] - 历史点的保留数量，用于计算平滑
   * @param {boolean} [options.velocitySmoothing=false] - 是否启用速度感知平滑
   * @param {number} [options.jitterThreshold=2.0] - 抖动检测阈值（像素），小于此值的移动可能被视为抖动
   * @param {number} [options.accelerationThreshold=0.3] - 加速度阈值，用于检测速度突变抖动
   */
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
    // 加速度阈值 - 用于检测速度突变
    this.accelerationThreshold = options.accelerationThreshold || 0.3
    // 上一次处理时间
    this._lastTime = 0
    // 速度历史
    this._velocities = []
    // 方向历史 - 用于检测方向变化
    this._directions = []
    // 抖动连续计数 - 用于累积抖动检测结果
    this._jitterCount = 0
  }

  /**
   * 平滑一个输入点
   *
   * 核心算法是基于加权平均的平滑，同时考虑速度和抖动因素：
   * - 对于快速移动，减少平滑以保持响应性
   * - 对于检测到的抖动，增强平滑以消除噪声
   * - 对于正常移动，使用标准平滑
   *
   * @param {Object} point - 输入点 {x, y}
   * @returns {Object} 平滑后的点 {x, y}
   */
  smooth(point) {
    // 如果平滑被禁用，直接返回原始点
    if (!this.enabled) {
      return point
    }

    // 第一个点没有历史数据，直接记录并返回
    if (this.lastPoints.length === 0) {
      this.lastPoints.push({ ...point, timestamp: Date.now() })
      this._lastTime = Date.now()
      return point
    }

    // 计算时间差，用于速度计算
    const now = Date.now()
    const deltaTime = Math.max(1, now - this._lastTime)
    this._lastTime = now

    const lastPoint = this.lastPoints[this.lastPoints.length - 1]

    // 抖动检测和过滤 - 需要至少两个历史点
    if (this.lastPoints.length >= 2) {
      // 计算当前点与最后一个历史点的距离
      const dx = point.x - lastPoint.x
      const dy = point.y - lastPoint.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      // 计算速度 (像素/毫秒)
      const velocity = dist / deltaTime
      this._velocities.push(velocity)

      // 保持速度历史长度上限为3
      if (this._velocities.length > 3) {
        this._velocities.shift()
      }

      // 计算平均速度，用于速度感知平滑
      const avgVelocity =
        this._velocities.reduce((a, b) => a + b, 0) / this._velocities.length

      // 计算当前移动方向并保存
      if (dist > 0.001) {
        const direction = { x: dx / dist, y: dy / dist }
        this._directions.push(direction)
        if (this._directions.length > 3) {
          this._directions.shift()
        }
      }

      // 改进的抖动检测 - 使用多种指标
      let isJitter = false

      // 1. 小距离移动检测
      const smallMovement = dist < this.jitterThreshold

      // 2. 方向一致性检测 - 方向变化频繁说明可能是抖动
      let directionChange = 0
      if (this._directions.length >= 2) {
        for (let i = 1; i < this._directions.length; i++) {
          const prevDir = this._directions[i - 1]
          const currDir = this._directions[i]
          // 计算方向点积 (1=相同方向，-1=相反方向)
          const dirDot = prevDir.x * currDir.x + prevDir.y * currDir.y
          // 累积方向变化量
          directionChange += 1 - dirDot // 0=没变化，2=完全反向
        }
        // 平均方向变化
        directionChange /= this._directions.length - 1
      }

      // 3. 速度突变检测 - 速度快速波动也是抖动特征
      let velocityVariation = 0
      if (this._velocities.length >= 2) {
        for (let i = 1; i < this._velocities.length; i++) {
          const ratio = this._velocities[i] / (this._velocities[i - 1] || 0.001)
          // 记录加速或减速比例
          velocityVariation += Math.abs(1 - ratio)
        }
        velocityVariation /= this._velocities.length - 1
      }

      // 综合判断是否是抖动
      // 小距离移动 + (方向变化大 或 速度波动大)
      if (
        smallMovement &&
        (directionChange > 0.8 ||
          velocityVariation > this.accelerationThreshold)
      ) {
        isJitter = true
        this._jitterCount++
      } else {
        // 逐渐减少抖动计数
        this._jitterCount = Math.max(0, this._jitterCount - 0.5)
      }

      // 快速移动处理策略：减少平滑强度以保持响应性
      if (avgVelocity > 0.5 && !isJitter) {
        // 根据速度动态调整平滑因子 - 速度越快，平滑越少
        const dynamicFactor = Math.max(0.1, this.factor - avgVelocity * 0.3)
        const smoothedPoint = {
          x: lastPoint.x * dynamicFactor + point.x * (1 - dynamicFactor),
          y: lastPoint.y * dynamicFactor + point.y * (1 - dynamicFactor),
          timestamp: now
        }

        // 更新历史点队列
        this.lastPoints.push(smoothedPoint)
        if (this.lastPoints.length > this.historySize) {
          this.lastPoints.shift()
        }

        return smoothedPoint
      }

      // 抖动处理 - 使用改进的多指标检测
      if (isJitter || this._jitterCount > 1) {
        // 抖动强度取决于累积的抖动计数
        const jitterStrength = Math.min(0.9, 0.6 + this._jitterCount * 0.1)

        // 检测到抖动，增强平滑力度
        const antiJitterFactor = Math.min(
          0.9,
          this.factor + jitterStrength * 0.3
        )
        const smoothedPoint = {
          x: lastPoint.x * antiJitterFactor + point.x * (1 - antiJitterFactor),
          y: lastPoint.y * antiJitterFactor + point.y * (1 - antiJitterFactor),
          timestamp: now
        }

        // 更新历史点队列
        this.lastPoints.push(smoothedPoint)
        if (this.lastPoints.length > this.historySize) {
          this.lastPoints.shift()
        }

        return smoothedPoint
      }
    }

    // 标准情况下的平滑处理
    // 使用当前点和最近历史点的加权平均
    const smoothedPoint = {
      x: lastPoint.x * this.factor + point.x * (1 - this.factor),
      y: lastPoint.y * this.factor + point.y * (1 - this.factor),
      timestamp: now
    }

    // 更新历史点队列
    this.lastPoints.push(smoothedPoint)
    if (this.lastPoints.length > this.historySize) {
      this.lastPoints.shift()
    }

    return smoothedPoint
  }

  /**
   * 重置平滑器状态
   *
   * 在开始新的笔画时调用，清除所有历史数据
   */
  reset() {
    this.lastPoints = []
    this._velocities = []
    this._directions = []
    this._jitterCount = 0
    this._lastTime = 0
  }

  /**
   * 设置平滑参数
   *
   * 允许在运行时动态调整平滑器的行为
   *
   * @param {Object} options - 要更新的配置选项
   * @param {number} [options.factor] - 平滑因子
   * @param {boolean} [options.enabled] - 是否启用平滑
   * @param {number} [options.historySize] - 历史点数量
   * @param {boolean} [options.velocitySmoothing] - 速度感知平滑
   * @param {number} [options.jitterThreshold] - 抖动阈值
   * @param {number} [options.accelerationThreshold] - 加速度阈值
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
    if (options.accelerationThreshold !== undefined)
      this.accelerationThreshold = options.accelerationThreshold
  }
}

// src/logger/StrokeAnalytics.js

/**
 * StrokeAnalytics：笔画行为分析器，记录用户绘制习惯。
 */
export class StrokeAnalytics {
  constructor(logger = null) {
    this.logger = logger

    this.strokeCount = 0
    this.totalPoints = 0
    this.averagePoints = 0
    this.strokeDurations = []
    this.directionChanges = 0
  }

  /**
   * 记录一次笔画信息
   * @param {import('../tools/Stroke.js').Stroke} stroke
   */
  track(stroke) {
    const pointCount = stroke.points.length
    const duration = Date.now() - stroke.timestamp

    // 分析方向变化
    let directionChanges = 0
    if (pointCount > 2) {
      for (let i = 2; i < pointCount; i++) {
        const p0 = stroke.points[i - 2]
        const p1 = stroke.points[i - 1]
        const p2 = stroke.points[i]

        const dx1 = p1.x - p0.x
        const dy1 = p1.y - p0.y
        const dx2 = p2.x - p1.x
        const dy2 = p2.y - p1.y

        const dot = dx1 * dx2 + dy1 * dy2
        const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
        const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

        if (mag1 > 0 && mag2 > 0) {
          const cosAngle = dot / (mag1 * mag2)
          if (cosAngle < 0.866) directionChanges++
        }
      }
    }

    // 更新整体统计
    this.strokeCount++
    this.totalPoints += pointCount
    this.averagePoints = this.totalPoints / this.strokeCount
    this.strokeDurations.push(duration)
    this.directionChanges += directionChanges

    // 可选：记录日志
    this.logger?.info("笔画完成", {
      points: pointCount,
      duration: duration + "ms",
      directionChanges,
      averagePressure:
        stroke.pressures.reduce((a, b) => a + b, 0) / stroke.pressures.length
    })
  }

  /**
   * 导出分析数据
   */
  exportStats() {
    return {
      strokeCount: this.strokeCount,
      totalPoints: this.totalPoints,
      averagePoints: this.averagePoints,
      totalDirectionChanges: this.directionChanges,
      averageDuration:
        this.strokeDurations.length > 0
          ? this.strokeDurations.reduce((a, b) => a + b) /
            this.strokeDurations.length
          : 0
    }
  }
}

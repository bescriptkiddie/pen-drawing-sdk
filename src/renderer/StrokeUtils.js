// 新模块：StrokeUtils.js
// 专门处理笔画点的预处理逻辑（平滑、采样、重采样）

export class StrokeUtils {
  /**
   * 点预平滑（低帧率优化）
   */
  static preSmoothPoints(points, pressures, lowFPS = false) {
    if (!lowFPS || points.length <= 4) {
      return { points, pressures }
    }

    const smoothedPoints = []
    const smoothedPressures = []
    smoothedPoints.push(points[0])
    smoothedPressures.push(pressures[0])

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      const v1x = curr.x - prev.x
      const v1y = curr.y - prev.y
      const v2x = next.x - curr.x
      const v2y = next.y - curr.y

      const len1 = v1x * v1x + v1y * v1y || 0.001
      const len2 = v2x * v2x + v2y * v2y || 0.001

      const dotProduct = (v1x * v2x + v1y * v2y) / Math.sqrt(len1 * len2)

      const smoothX = (prev.x + curr.x * 2 + next.x) / 4
      const smoothY = (prev.y + curr.y * 2 + next.y) / 4

      if (dotProduct < 0.7) {
        smoothedPoints.push({
          x: (curr.x * 3 + smoothX) / 4,
          y: (curr.y * 3 + smoothY) / 4
        })
      } else {
        smoothedPoints.push({ x: smoothX, y: smoothY })
      }

      smoothedPressures.push(
        (pressures[i - 1] + pressures[i] * 2 + pressures[i + 1]) / 4
      )
    }

    smoothedPoints.push(points[points.length - 1])
    smoothedPressures.push(pressures[pressures.length - 1])

    return { points: smoothedPoints, pressures: smoothedPressures }
  }

  /**
   * 智能采样关键点
   */
  static sampleKeyPoints(
    points,
    { angleThreshold = 0.06, distanceThreshold = 6, maxSkipPoints = 4 } = {}
  ) {
    if (points.length <= 3) return [...points]
    const result = [points[0]]
    let lastAddedIndex = 0

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[lastAddedIndex]
      const curr = points[i]
      const next = points[i + 1]

      const dx = curr.x - prev.x
      const dy = curr.y - prev.y
      const dist2 = dx * dx + dy * dy

      const v1x = dx
      const v1y = dy
      const v2x = next.x - curr.x
      const v2y = next.y - curr.y

      const len1 = v1x * v1x + v1y * v1y || 0.001
      const len2 = v2x * v2x + v2y * v2y || 0.001
      const dot = (v1x * v2x + v1y * v2y) / Math.sqrt(len1 * len2)
      const angleChange = Math.acos(Math.max(-1, Math.min(1, dot)))

      const adaptiveThreshold =
        distanceThreshold * (0.2 + 0.8 * Math.min(1, (1 + dot) / 2))

      if (
        angleChange > angleThreshold ||
        dist2 > adaptiveThreshold * adaptiveThreshold ||
        i - lastAddedIndex > maxSkipPoints
      ) {
        result.push(curr)
        lastAddedIndex = i
      }
    }

    result.push(points[points.length - 1])
    return result
  }

  /**
   * 压力值重采样
   */
  static resamplePressures(pressures, originalPoints, sampledPoints) {
    if (originalPoints.length !== pressures.length) {
      return sampledPoints.map(() => 0.5)
    }

    const result = []
    let lastFoundIndex = 0
    const windowSize = Math.min(20, Math.ceil(originalPoints.length / 4))

    for (const point of sampledPoints) {
      let minDist = Infinity
      let closestIndex = lastFoundIndex
      const sx = point.x
      const sy = point.y

      const start = Math.max(0, lastFoundIndex - windowSize)
      const end = Math.min(
        originalPoints.length - 1,
        lastFoundIndex + windowSize
      )

      for (let i = start; i <= end; i++) {
        const dx = sx - originalPoints[i].x
        const dy = sy - originalPoints[i].y
        const dist2 = dx * dx + dy * dy
        if (dist2 < minDist) {
          minDist = dist2
          closestIndex = i
        }
      }

      lastFoundIndex = closestIndex
      result.push(pressures[closestIndex] ?? 0.5)
    }

    return result
  }
}

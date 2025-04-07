// src/utils/device.js

/**
 * 获取当前设备的 DPR（设备像素比）
 * @returns {number}
 */
export function getDevicePixelRatio() {
  return window.devicePixelRatio || 1
}

/**
 * 测试当前设备的处理性能
 * @param {number} testDuration - 测试时长（毫秒），默认 100ms
 * @returns {Promise<{ score: number, iterations: number }>}
 */
export async function measureDevicePerformance(testDuration = 100) {
  const startTime = performance.now()
  let iterations = 0

  while (performance.now() - startTime < testDuration) {
    for (let i = 0; i < 10000; i++) {
      Math.sin(i) * Math.cos(i)
    }
    iterations++
  }

  // 将迭代次数映射为性能分数（假设 50 为高性能）
  const score = Math.min(1.0, iterations / 50)
  return { score, iterations }
}

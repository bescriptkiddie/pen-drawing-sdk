// src/input/StylusAdapter.js

/**
 * StylusAdapter：根据不同设备提供压力处理逻辑
 */
export class StylusAdapter {
  constructor() {
    this.profileMap = {
      surface: {
        pressureCurve: [0.1, 1.2],
        widthRange: [1, 6],
        minPressure: 0.1
      },
      wacom: {
        pressureCurve: [0.8, 1.0],
        widthRange: [0.8, 5.5],
        minPressure: 0.05
      },
      apple: {
        pressureCurve: [1.0, 1.1],
        widthRange: [1.2, 6.0],
        minPressure: 0.01
      },
      default: {
        pressureCurve: [1.0, 1.0],
        widthRange: [1.0, 5.0],
        minPressure: 0.1
      }
    }

    this.currentProfile = this.profileMap["default"]
  }

  /**
   * 设置当前使用的触控笔配置
   * @param {string} profileName - 例如 'surface', 'wacom', 'apple'
   */
  useProfile(profileName) {
    this.currentProfile =
      this.profileMap[profileName] || this.profileMap["default"]
  }

  /**
   * 对原始 event 压力值进行映射（支持 sigmoid、拉伸等）
   * @param {PointerEvent} event
   * @returns {number} 映射后的压力值 (0~1)
   */
  mapPressure(event) {
    let pressure = 0.5

    if (event.pointerType === "pen" && event.pressure >= 0) {
      pressure = event.pressure

      // 使用 Sigmoid 函数调整压力分布，使中段区间更灵敏
      pressure = 1 / (1 + Math.exp(-6 * (pressure - 0.3)))

      // 再次拉伸到期望范围（示例区间0.05-0.95）
      pressure = Math.max(
        0.05,
        Math.min(0.95, 0.05 + (0.9 * (pressure - 0.2)) / 0.5)
      )
    }

    return pressure
  }
}

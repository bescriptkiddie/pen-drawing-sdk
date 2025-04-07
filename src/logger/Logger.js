// src/logger/Logger.js

/**
 * Logger：统一的日志系统，支持分级输出。
 */
export class Logger {
  /**
   * @param {string} moduleName - 模块名称，用于日志前缀
   * @param {'debug'|'info'|'warn'|'error'} level - 最低输出级别
   */
  constructor(moduleName = "DrawingBoard", level = "info") {
    this.moduleName = moduleName
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
    this.level = level
    this.enabled = true
  }

  /**
   * 设置日志等级
   * @param {string} level
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.level = level
    }
  }

  /**
   * 输出日志
   * @param {'debug'|'info'|'warn'|'error'} type
   * @param {string} message
   * @param {any} [data]
   */
  log(type, message, data) {
    if (!this.enabled) return
    if (this.levels[type] < this.levels[this.level]) return

    const prefix = `[${this.moduleName}][${type.toUpperCase()}]`
    if (data !== undefined) {
      try {
        console.log(
          prefix,
          message,
          typeof data === "object" ? JSON.stringify(data) : data
        )
      } catch {
        console.log(prefix, message, String(data))
      }
    } else {
      console.log(prefix, message)
    }
  }

  debug(msg, data) {
    this.log("debug", msg, data)
  }

  info(msg, data) {
    this.log("info", msg, data)
  }

  warn(msg, data) {
    this.log("warn", msg, data)
  }

  error(msg, data) {
    this.log("error", msg, data)
  }

  /**
   * 启用或禁用日志
   * @param {boolean} state
   */
  setEnabled(state) {
    this.enabled = state
  }
}

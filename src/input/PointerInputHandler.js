// src/input/PointerInputHandler.js

/**
 * 指针输入处理模块：统一处理鼠标、触控、触控笔等输入类型。
 */
export class PointerInputHandler {
  /**
   * @param {HTMLCanvasElement} canvas - 画布 DOM 元素
   * @param {function} pressureResolver - 计算压力值的方法
   */
  constructor(canvas, pressureResolver) {
    this.canvas = canvas
    this.getPressure = pressureResolver
    this.pointerIds = new Set()
    this.lastPointerType = null
  }

  /**
   * 绑定指针相关事件
   * @param {Object} handlers - 各类事件处理器
   */
  bindEvents(handlers) {
    const { onPointerDown, onPointerMove, onPointerUp } = handlers

    this.canvas.addEventListener("pointerdown", (e) => {
      this.pointerIds.add(e.pointerId)
      this.lastPointerType = e.pointerType
      onPointerDown?.(e)
    })

    this.canvas.addEventListener("pointermove", (e) => {
      if (this.pointerIds.has(e.pointerId)) {
        onPointerMove?.(e)
      }
    })

    this.canvas.addEventListener("pointerup", (e) => {
      this.pointerIds.delete(e.pointerId)
      onPointerUp?.(e)
    })

    this.canvas.addEventListener("pointerleave", (e) => {
      this.pointerIds.delete(e.pointerId)
      onPointerUp?.(e)
    })

    // 禁止默认行为
    this.canvas.style.touchAction = "none"
  }

  /**
   * 获取当前 pointer 在 canvas 内的坐标（CSS 像素）
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x: number, y: number}}
   */
  getPointerPosition(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }
}

# Pen SDK

## 概述

Pen SDK 是一个高性能的绘图库，专为创建流畅的手写/绘图体验而设计。它支持压力感应，轨迹平滑，以及高质量的渲染，适用于数字笔记、绘图应用、白板等场景。

## 特性

- 🖌️ 多种绘图工具（钢笔、粉笔、橡皮擦等）
- 🔄 撤销/重做功能
- 📱 触控笔压力感应支持
- 🚀 高性能渲染，适应不同设备
- 🎯 智能轨迹平滑，减少手部抖动
- 📊 性能监控和分析功能
- 📱 自适应渲染质量（根据设备性能）

## 安装

```bash
npm install pen-drawing-sdk
```

## 基本用法

```html
<div id="drawing-board" style="width: 800px; height: 600px;"></div>

<script>
  import { DrawingBoard } from "pen-drawing-sdk"

  // 初始化绘图板
  const drawingBoard = new DrawingBoard("drawing-board")
</script>
```

## API 文档

### DrawingBoard 类

主要的绘图控制器类，管理整个绘图流程。

#### 构造函数

```javascript
const drawingBoard = new DrawingBoard(canvasId, options)
```

参数:

- `canvasId`: string - 要用作绘图区域的 canvas 元素 ID
- `options`: object (可选) - 配置选项

#### 方法

- **工具操作**

  - `setTool(tool)` - 设置当前工具（'pen', 'eraser', 'chalk'）
  - `setToolSize(size)` - 设置工具尺寸
  - `getToolSize()` - 获取当前工具尺寸
  - `toggleInputMode()` - 切换输入模式（鼠标/触控笔）

- **历史操作**

  - `undo()` - 撤销上一个笔画
  - `redo()` - 重做上一个撤销的操作
  - `clear()` - 清空画布

- **分析和导出**

  - `exportLogs()` - 导出绘图日志和分析数据
  - `exportDetailedAnalysis()` - 导出详细的性能和行为分析

- **性能控制**
  - `simulateLowFPS(enable)` - 启用/禁用低帧率模式

## 在 Vue 中集成

### 方法 1: 创建 Vue 组件

```vue
<!-- DrawingCanvas.vue -->
<template>
  <div>
    <div
      ref="canvasContainer"
      :style="{ width: width + 'px', height: height + 'px' }"
    ></div>
    <div class="toolbar">
      <button @click="handleUndo">撤销</button>
      <button @click="handleRedo">重做</button>
      <button @click="handleClear">清空</button>
      <select v-model="currentTool" @change="handleToolChange">
        <option value="pen">钢笔</option>
        <option value="eraser">橡皮擦</option>
        <option value="chalk">粉笔</option>
      </select>
      <input
        type="range"
        min="1"
        max="30"
        v-model.number="toolSize"
        @input="handleSizeChange"
      />
    </div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount, ref } from "vue"
import { DrawingBoard } from "pen-drawing-sdk"

export default {
  name: "DrawingCanvas",
  props: {
    width: {
      type: Number,
      default: 800
    },
    height: {
      type: Number,
      default: 600
    }
  },

  setup(props, { emit }) {
    const canvasContainer = ref(null)
    const drawingBoard = ref(null)
    const currentTool = ref("pen")
    const toolSize = ref(5)

    onMounted(() => {
      // 创建随机ID以避免冲突
      const canvasId = `drawing-canvas-${Math.random()
        .toString(36)
        .substring(2, 9)}`

      // 创建canvas元素
      const canvas = document.createElement("canvas")
      canvas.id = canvasId
      canvas.style.width = "100%"
      canvas.style.height = "100%"
      canvasContainer.value.appendChild(canvas)

      // 初始化绘图板
      drawingBoard.value = new DrawingBoard(canvasId)
      drawingBoard.value.setTool(currentTool.value)
      drawingBoard.value.setToolSize(toolSize.value)

      // 设置工具初始值
      currentTool.value = "pen"
      toolSize.value = drawingBoard.value.getToolSize()
    })

    onBeforeUnmount(() => {
      // 清理资源
      if (canvasContainer.value && canvasContainer.value.firstChild) {
        canvasContainer.value.removeChild(canvasContainer.value.firstChild)
      }
    })

    // 处理工具栏事件
    const handleUndo = () => {
      drawingBoard.value?.undo()
      emit("undo")
    }

    const handleRedo = () => {
      drawingBoard.value?.redo()
      emit("redo")
    }

    const handleClear = () => {
      drawingBoard.value?.clear()
      emit("clear")
    }

    const handleToolChange = () => {
      drawingBoard.value?.setTool(currentTool.value)
      emit("tool-change", currentTool.value)
    }

    const handleSizeChange = () => {
      drawingBoard.value?.setToolSize(toolSize.value)
      emit("size-change", toolSize.value)
    }

    // 暴露方法给父组件
    const exportImage = () => {
      return canvasContainer.value?.querySelector("canvas")?.toDataURL()
    }

    const exportLogs = () => {
      return drawingBoard.value?.exportLogs()
    }

    return {
      canvasContainer,
      currentTool,
      toolSize,
      handleUndo,
      handleRedo,
      handleClear,
      handleToolChange,
      handleSizeChange,
      exportImage,
      exportLogs
    }
  }
}
</script>

<style scoped>
.toolbar {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
```

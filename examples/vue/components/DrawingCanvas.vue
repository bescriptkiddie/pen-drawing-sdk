<template>
  <div class="drawing-canvas">
    <div
      ref="canvasContainer"
      class="canvas-wrapper"
      :style="{ width: width + 'px', height: height + 'px' }"
    ></div>
    <div class="toolbar">
      <button
        v-for="tool in tools"
        :key="tool.value"
        :class="{ active: currentTool === tool.value }"
        @click="handleToolChange(tool.value)"
      >
        {{ tool.label }}
      </button>

      <div class="size-control">
        <span class="size-label">尺寸: {{ toolSize }}</span>
        <input
          type="range"
          :min="1"
          :max="30"
          v-model.number="toolSize"
          @input="handleSizeChange"
        />
      </div>

      <button @click="handleUndo">撤销</button>
      <button @click="handleRedo">重做</button>
      <button @click="handleClear">清空</button>

      <select v-model="inputMode" @change="handleInputModeChange">
        <option value="pen">触控笔</option>
        <option value="mouse">鼠标</option>
      </select>
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
    const inputMode = ref("pen")

    const tools = [
      { label: "钢笔", value: "pen" },
      { label: "橡皮擦", value: "eraser" },
      { label: "粉笔", value: "chalk" }
    ]

    onMounted(() => {
      // 创建随机ID以避免冲突
      const canvasId = `drawing-canvas-${Math.random()
        .toString(36)
        .substring(2, 9)}`

      // 创建canvas元素
      const canvas = document.createElement("canvas")
      canvas.id = canvasId
      canvas.width = props.width
      canvas.height = props.height
      canvas.style.width = "100%"
      canvas.style.height = "100%"
      canvasContainer.value.appendChild(canvas)

      // 初始化绘图板
      drawingBoard.value = new DrawingBoard(canvasId)
      drawingBoard.value.setTool(currentTool.value)
      drawingBoard.value.setToolSize(toolSize.value)

      // 设置工具初始值
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

    const handleToolChange = (tool) => {
      currentTool.value = tool
      drawingBoard.value?.setTool(tool)
      emit("tool-change", tool)
    }

    const handleSizeChange = () => {
      drawingBoard.value?.setToolSize(toolSize.value)
      emit("size-change", toolSize.value)
    }

    const handleInputModeChange = () => {
      const newMode = drawingBoard.value?.toggleInputMode()
      inputMode.value = newMode
      emit("input-mode-change", newMode)
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
      inputMode,
      tools,
      handleUndo,
      handleRedo,
      handleClear,
      handleToolChange,
      handleSizeChange,
      handleInputModeChange,
      exportImage,
      exportLogs
    }
  }
}
</script>

<style scoped>
.drawing-canvas {
  width: 100%;
}

.canvas-wrapper {
  border: 1px solid #ddd;
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  background-color: #fff;
  touch-action: none; /* 防止触摸设备上的滚动手势 */
  margin-bottom: 15px;
}

.toolbar {
  margin-top: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

button {
  padding: 8px 15px;
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background-color: #3a7bc8;
}

button.active {
  background-color: #2a5a98;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
}

select {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.size-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.size-label {
  min-width: 80px;
}

input[type="range"] {
  width: 120px;
}
</style>

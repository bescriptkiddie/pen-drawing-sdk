<template>
  <div class="app">
    <h1>Pen SDK - Vue示例</h1>
    <drawing-canvas
      :width="800"
      :height="600"
      @undo="onUndo"
      @redo="onRedo"
      @clear="onClear"
      @tool-change="onToolChange"
      @size-change="onSizeChange"
      ref="drawingCanvas"
    />
    <div class="export-section">
      <button @click="exportImage">导出图片</button>
      <button @click="exportLogs">导出日志</button>
    </div>
    <div class="status-bar">
      <p>当前工具: {{ currentTool }} | 尺寸: {{ currentSize }}</p>
      <p v-if="lastAction">上次操作: {{ lastAction }}</p>
    </div>
  </div>
</template>

<script>
import DrawingCanvas from './components/DrawingCanvas.vue'

export default {
  components: {
    DrawingCanvas
  },
  data() {
    return {
      currentTool: 'pen',
      currentSize: 5,
      lastAction: null
    }
  },
  methods: {
    onUndo() {
      this.lastAction = '撤销'
    },
    onRedo() {
      this.lastAction = '重做'
    },
    onClear() {
      this.lastAction = '清空画布'
    },
    onToolChange(tool) {
      this.currentTool = tool
      this.lastAction = `切换工具: ${tool}`
    },
    onSizeChange(size) {
      this.currentSize = size
      this.lastAction = `调整尺寸: ${size}`
    },
    exportImage() {
      const dataUrl = this.$refs.drawingCanvas.exportImage()
      if (dataUrl) {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `drawing-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`
        link.click()
        this.lastAction = '导出图片'
      }
    },
    exportLogs() {
      this.$refs.drawingCanvas.exportLogs()
      this.lastAction = '导出日志'
    }
  }
}
</script>

<style>
.app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #333;
}

.export-section {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 15px;
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #3a7bc8;
}

.status-bar {
  margin-top: 20px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
}
</style>

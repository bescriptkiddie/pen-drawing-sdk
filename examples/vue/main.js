import { createApp } from "vue"
import App from "./App.vue"

// 在实际项目中，应该通过npm引入
// import { DrawingBoard } from 'pen-drawing-sdk'
// 这里我们假设使用的是相对路径引入
import { DrawingBoard } from "../../dist/pen-sdk.esm.js"

// 可选：将SDK的核心类暴露为全局变量，方便调试
window.DrawingBoard = DrawingBoard

createApp(App).mount("#app")

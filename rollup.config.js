import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"
import { terser } from "rollup-plugin-terser"

const pkg = require("./package.json")

export default [
  // UMD构建 (适用于浏览器)
  {
    input: "src/index.js",
    output: {
      name: "PenSDK",
      file: pkg.browser,
      format: "umd",
      exports: "named"
    },
    plugins: [resolve(), commonjs(), terser()]
  },

  // CommonJS (适用于Node.js)和ES模块构建
  {
    input: "src/index.js",
    output: [
      { file: pkg.main, format: "cjs", exports: "named" },
      { file: pkg.module, format: "es", exports: "named" }
    ],
    plugins: [resolve(), commonjs()]
  }
]

// src/tools/Stroke.js

/**
 * Stroke类：表示一个完整的笔画
 *
 * 这个类用于存储和管理用户绘制的单个笔画，包含了：
 * - 点坐标序列
 * - 每个点的压力值
 * - 工具类型（如：笔、橡皮擦等）
 * - 笔画颜色和宽度信息
 * - 时间戳
 *
 * 它提供了添加点、检查有效性、获取边界框和克隆等功能。
 */
class Stroke {
  /**
   * 创建一个新的笔画对象
   *
   * @param {string} tool - 工具类型，例如 'pen'、'eraser'、'chalk'等
   * @param {Object} startPoint - 起始点位置，格式为 {x, y}
   * @param {number} pressure - 起始压力值，范围0~1之间
   * @param {number} baseSize - 工具的基础大小/宽度
   */
  constructor(tool, startPoint, pressure = 0.5, baseSize = 3) {
    this.tool = tool;
    this.points = [startPoint]; // 存储所有点坐标的数组
    this.pressures = [pressure]; // 存储每个点对应的压力值
    this.color = tool === "eraser" ? "white" : "black"; // 根据工具类型设置颜色
    this.width = baseSize; // 当前宽度
    this.baseSize = baseSize; // 基础宽度（不受压力影响的部分）
    this.timestamp = Date.now(); // 创建时间戳，用于历史记录
  }

  /**
   * 添加一个点到笔画中
   *
   * 当用户移动指针时，新的点会被添加到笔画中，形成连续的路径
   *
   * @param {Object} point - 格式为 {x, y} 的点坐标
   * @param {number} pressure - 当前点的压力值，范围0~1
   */
  addPoint(point, pressure = 0.5) {
    this.points.push(point);
    this.pressures.push(pressure);
  }

  /**
   * 判断该笔画是否有效
   *
   * 有效的笔画至少需要两个点才能形成一条线段
   * 这个方法用于过滤掉无效的（例如单击但未移动形成的）笔画
   *
   * @returns {boolean} 如果笔画有效（包含至少两个点）则返回true
   */
  isValid() {
    return this.points.length >= 2
  }

  /**
   * 获取笔画的包围盒
   *
   * 计算包含整个笔画的最小矩形区域，这对于：
   * - 优化渲染（只重绘包含笔画的区域）
   * - 选择工具
   * - 碰撞检测
   * 等功能非常有用
   *
   * @returns {{minX: number, minY: number, maxX: number, maxY: number}} 包围盒坐标
   */
  getBoundingBox() {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // 遍历所有点找出最小和最大的X、Y坐标
    for (const point of this.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }

    return { minX, minY, maxX, maxY }
  }

  /**
   * 克隆当前笔画
   *
   * 创建一个当前笔画的深拷贝，常用于：
   * - 历史记录功能（撤销/重做）
   * - 临时修改而不影响原始笔画
   *
   * @returns {Stroke} 当前笔画的完整克隆
   */
  clone() {
    const clone = new Stroke(
      this.tool,
      this.points[0],
      this.pressures[0],
      this.baseSize
    );
    // 深拷贝所有属性
    clone.points = [...this.points];
    clone.pressures = [...this.pressures];
    clone.color = this.color;
    clone.width = this.width;
    clone.timestamp = this.timestamp;
    return clone
  }
}

// src/tools/ToolManager.js

/**
 * 工具管理器：用于管理当前工具类型、默认尺寸、自定义尺寸。
 */
class ToolManager {
  constructor() {
    this.currentTool = "pen";

    this.defaultSizes = {
      pen: 3,
      chalk: 5,
      eraser: 20
    };

    this.customSizes = {
      pen: 3,
      chalk: 5,
      eraser: 20
    };
  }

  /**
   * 设置当前工具类型
   * @param {string} tool - 工具名："pen" | "chalk" | "eraser"
   */
  setTool(tool) {
    if (["pen", "chalk", "eraser"].includes(tool)) {
      this.currentTool = tool;
    } else {
      console.warn(`未知工具类型: ${tool}`);
    }
  }

  /**
   * 获取当前或指定工具的尺寸
   * @param {string} [tool] - 可选，指定工具名
   * @returns {number}
   */
  getToolSize(tool) {
    tool = tool || this.currentTool;

    if (this.customSizes?.[tool] !== undefined) {
      return this.customSizes[tool]
    }

    return this.defaultSizes[tool] || 3
  }

  /**
   * 设置工具的自定义大小
   * @param {number} size - 新的尺寸值
   * @param {string} [tool] - 可选，指定工具名
   * @returns {boolean} 是否设置成功
   */
  setToolSize(size, tool) {
    tool = tool || this.currentTool;
    const parsed = parseFloat(size);

    if (!isNaN(parsed) && parsed > 0) {
      this.customSizes[tool] = parsed;
      return true
    }

    return false
  }

  /**
   * 获取当前工具名
   * @returns {string}
   */
  getCurrentTool() {
    return this.currentTool
  }
}

// src/input/PointerInputHandler.js

/**
 * 指针输入处理模块：统一处理鼠标、触控、触控笔等输入类型。
 */
class PointerInputHandler {
  /**
   * @param {HTMLCanvasElement} canvas - 画布 DOM 元素
   * @param {function} pressureResolver - 计算压力值的方法
   */
  constructor(canvas, pressureResolver) {
    this.canvas = canvas;
    this.getPressure = pressureResolver;
    this.pointerIds = new Set();
    this.lastPointerType = null;
  }

  /**
   * 绑定指针相关事件
   * @param {Object} handlers - 各类事件处理器
   */
  bindEvents(handlers) {
    const { onPointerDown, onPointerMove, onPointerUp } = handlers;

    this.canvas.addEventListener("pointerdown", (e) => {
      this.pointerIds.add(e.pointerId);
      this.lastPointerType = e.pointerType;
      onPointerDown?.(e);
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (this.pointerIds.has(e.pointerId)) {
        onPointerMove?.(e);
      }
    });

    this.canvas.addEventListener("pointerup", (e) => {
      this.pointerIds.delete(e.pointerId);
      onPointerUp?.(e);
    });

    this.canvas.addEventListener("pointerleave", (e) => {
      this.pointerIds.delete(e.pointerId);
      onPointerUp?.(e);
    });

    // 禁止默认行为
    this.canvas.style.touchAction = "none";
  }

  /**
   * 获取当前 pointer 在 canvas 内的坐标（CSS 像素）
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{x: number, y: number}}
   */
  getPointerPosition(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }
}

// src/input/StylusAdapter.js

/**
 * StylusAdapter：根据不同设备提供压力处理逻辑
 */
class StylusAdapter {
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
    };

    this.currentProfile = this.profileMap["default"];
  }

  /**
   * 设置当前使用的触控笔配置
   * @param {string} profileName - 例如 'surface', 'wacom', 'apple'
   */
  useProfile(profileName) {
    this.currentProfile =
      this.profileMap[profileName] || this.profileMap["default"];
  }

  /**
   * 对原始 event 压力值进行映射（支持 sigmoid、拉伸等）
   * @param {PointerEvent} event
   * @returns {number} 映射后的压力值 (0~1)
   */
  mapPressure(event) {
    let pressure = 0.5;

    if (event.pointerType === "pen" && event.pressure >= 0) {
      pressure = event.pressure;

      // 使用 Sigmoid 函数调整压力分布，使中段区间更灵敏
      pressure = 1 / (1 + Math.exp(-6 * (pressure - 0.3)));

      // 再次拉伸到期望范围（示例区间0.05-0.95）
      pressure = Math.max(
        0.05,
        Math.min(0.95, 0.05 + (0.9 * (pressure - 0.2)) / 0.5)
      );
    }

    return pressure
  }
}

// src/utils/math.js

/**
 * 简单线性插值
 * @param {number} a 起点值
 * @param {number} b 终点值
 * @param {number} t 插值系数 0~1
 * @returns {number}
 */
function lerp(a, b, t) {
  return a * (1 - t) + b * t
}

/**
 * 二维向量计算工具
 * 提供向量基本运算方法，方便绘图算法使用
 */
const Vec2 = {
  /**
   * 计算向量长度
   * @param {{x: number, y: number}} v 向量
   * @returns {number} 向量长度
   */
  length(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y) || 0.001 // 避免除以零
  },

  /**
   * 计算两点之间的距离
   * @param {{x: number, y: number}} p1 第一个点
   * @param {{x: number, y: number}} p2 第二个点
   * @returns {number} 两点间距离
   */
  distance(p1, p2) {
    return Vec2.length({ x: p2.x - p1.x, y: p2.y - p1.y })
  },

  /**
   * 归一化向量（单位向量）
   * @param {{x: number, y: number}} v 向量
   * @returns {{x: number, y: number}} 归一化后的向量
   */
  normalize(v) {
    const len = Vec2.length(v);
    return {
      x: v.x / len,
      y: v.y / len
    }
  },

  /**
   * 创建从p1指向p2的向量
   * @param {{x: number, y: number}} p1 起点
   * @param {{x: number, y: number}} p2 终点
   * @returns {{x: number, y: number}} 从p1到p2的向量
   */
  fromPoints(p1, p2) {
    return {
      x: p2.x - p1.x,
      y: p2.y - p1.y
    }
  },

  /**
   * 计算两个向量的点积
   * @param {{x: number, y: number}} v1 向量1
   * @param {{x: number, y: number}} v2 向量2
   * @returns {number} 点积结果
   */
  dot(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y
  },

  /**
   * 按比例缩放向量
   * @param {{x: number, y: number}} v 原向量
   * @param {number} scale 缩放比例
   * @returns {{x: number, y: number}} 缩放后的向量
   */
  scale(v, scale) {
    return {
      x: v.x * scale,
      y: v.y * scale
    }
  },

  /**
   * 将一个向量加到另一个向量上
   * @param {{x: number, y: number}} v1 向量1
   * @param {{x: number, y: number}} v2 向量2
   * @returns {{x: number, y: number}} 相加后的向量
   */
  add(v1, v2) {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y
    }
  },

  /**
   * 线性插值两个向量
   * @param {{x: number, y: number}} v1 起始向量
   * @param {{x: number, y: number}} v2 结束向量
   * @param {number} t 插值系数 (0-1)
   * @returns {{x: number, y: number}} 插值结果
   */
  lerp(v1, v2, t) {
    return {
      x: lerp(v1.x, v2.x, t),
      y: lerp(v1.y, v2.y, t)
    }
  }
};

// src/renderer/SmoothStrategy.js

/**
 * 计算基于动量的二次贝塞尔曲线控制点
 *
 * 该算法考虑了笔迹的运动趋势和转弯角度，生成更自然的曲线：
 * 1. 计算前后段向量并归一化
 * 2. 基于转弯角度调整动量因子
 * 3. 根据运动方向的连续性计算混合方向
 * 4. 使用上述因素计算出最佳控制点位置
 *
 * 这种方法尤其适合处理手写笔迹的流畅性和连续性。
 *
 * @param {Object} p0 - 起始点 {x, y}
 * @param {Object} p1 - 中间点 {x, y}
 * @param {Object} p2 - 终点 {x, y}
 * @param {Object} options - 控制参数
 * @param {number} options.momentumFactor - 动量因子(0~1)，越大曲线越圆滑
 * @returns {Object} 控制点坐标 {cx, cy}
 */
function getMomentumControlPoint(p0, p1, p2, options = {}) {
  // 计算运动向量
  const v1x = p1.x - p0.x;
  const v1y = p1.y - p0.y;
  const v2x = p2.x - p1.x;
  const v2y = p2.y - p1.y;

  // 计算向量长度
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 0.001;
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 0.001;

  // 动量跟随因子 - 调整曲线的"惯性"
  const momentumFactor = options.momentumFactor || 0.4; // 增加默认动量因子

  // 计算两个向量的单位向量
  const u1x = v1x / len1;
  const u1y = v1y / len1;
  const u2x = v2x / len2;
  const u2y = v2y / len2;

  // 基于两段向量的夹角计算控制点位置
  const dotProduct = u1x * u2x + u1y * u2y;

  // 曲率因子：角度变化越大，控制点需要更强的调整
  // 当dotProduct接近-1（接近180度转弯）时，曲率因子接近2
  // 当dotProduct接近1（直线）时，曲率因子接近0
  const curvatureFactor = Math.max(0, 1 - dotProduct);

  // 根据曲率自适应调整动量
  const adaptiveMomentum = momentumFactor * (1 + curvatureFactor);

  // 根据转弯角度计算控制点位置
  // 在急转弯处，更倾向于使用前一段的方向
  const blendFactor = Math.min(1, Math.max(0, (1 + dotProduct) / 1.5));

  // 计算混合向量（根据角度混合两段向量的方向）
  const blendX = u1x * (1 - blendFactor) + u2x * blendFactor;
  const blendY = u1y * (1 - blendFactor) + u2y * blendFactor;

  // 标准化混合向量
  const blendLen = Math.sqrt(blendX * blendX + blendY * blendY) || 0.001;
  const normBlendX = blendX / blendLen;
  const normBlendY = blendY / blendLen;

  // 控制点长度 - 使用自适应动量和混合向量的长度
  const controlLen = ((len1 + len2) / 2) * adaptiveMomentum;

  return {
    cx: p1.x + normBlendX * controlLen,
    cy: p1.y + normBlendY * controlLen
  }
}

/**
 * 计算基于四点的三次贝塞尔曲线控制点
 *
 * 这是最强大的曲线控制点计算方法，适用于复杂笔迹的中间段：
 * 1. 分析三段向量的方向和速度
 * 2. 基于曲率和速度计算自适应控制因子
 * 3. 对急转弯和直线段采用不同的混合策略
 * 4. 生成两个控制点以创建平滑的三次贝塞尔曲线
 *
 * 这种方法能很好地保持笔迹的连续性、流畅度和形状特征。
 *
 * @param {Object} p0 - 第一个点 {x, y}
 * @param {Object} p1 - 第二个点 {x, y}（曲线起点）
 * @param {Object} p2 - 第三个点 {x, y}（曲线终点）
 * @param {Object} p3 - 第四个点 {x, y}
 * @param {Object} options - 控制参数
 * @param {number} options.controlFactor - 控制强度因子
 * @param {number} options.speedThreshold - 速度阈值，用于自适应控制
 * @returns {Object} 两个控制点坐标 {cp1x, cp1y, cp2x, cp2y}
 */
function getCubicMomentumControlPoints(p0, p1, p2, p3, options = {}) {
  // 计算相邻段的向量
  const v1 = { x: p1.x - p0.x, y: p1.y - p0.y };
  const v2 = { x: p2.x - p1.x, y: p2.y - p1.y };
  const v3 = { x: p3.x - p2.x, y: p3.y - p2.y };

  // 向量长度（代表速度）
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001;
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001;
  const len3 = Math.sqrt(v3.x * v3.x + v3.y * v3.y) || 0.001;

  // 单位向量（代表方向）
  const u1 = { x: v1.x / len1, y: v1.y / len1 };
  const u2 = { x: v2.x / len2, y: v2.y / len2 };
  const u3 = { x: v3.x / len3, y: v3.y / len3 };

  // 点积计算转弯角度（-1到1之间，1表示同向，-1表示反向）
  const dp1 = u1.x * u2.x + u1.y * u2.y;
  const dp2 = u2.x * u3.x + u2.y * u3.y;

  // 曲率因子：角度变化越大，曲率因子越高
  const curvature1 = Math.max(0, 1 - dp1);
  const curvature2 = Math.max(0, 1 - dp2);

  // 速度因子 - 速度越快，控制点距离越长
  const speed = (len1 + len2 + len3) / 3;
  const speedFactor = Math.min(1, speed / (options.speedThreshold || 25));

  // 基础控制因子
  const baseControlFactor = options.controlFactor || 0.35; // 增加基础控制因子

  // 计算贝塞尔控制点长度 - 曲率自适应
  // 曲率大时增加控制点长度，使曲线更顺滑
  const ctrl1Len =
    len2 * baseControlFactor * (1 + curvature1 * 0.75 + speedFactor * 0.5);
  const ctrl2Len =
    len2 * baseControlFactor * (1 + curvature2 * 0.75 + speedFactor * 0.5);

  // 混合向量计算 - 根据转弯角度平滑混合方向
  // 转弯小时，混合更多下一段的方向；转弯大时，保持当前方向
  const blendFactor1 = Math.min(1, Math.max(0, (1 + dp1) / 1.5));
  const blendFactor2 = Math.min(1, Math.max(0, (1 + dp2) / 1.5));

  // 混合前后两段的方向
  // 在急转弯处更偏向于维持当前运动方向
  const blend1 = {
    x: u1.x * (1 - blendFactor1 * 0.7) + u2.x * blendFactor1 * 0.3,
    y: u1.y * (1 - blendFactor1 * 0.7) + u2.y * blendFactor1 * 0.3
  };

  const blend2 = {
    x: u2.x * (1 - blendFactor2 * 0.3) + u3.x * blendFactor2 * 0.7,
    y: u2.y * (1 - blendFactor2 * 0.3) + u3.y * blendFactor2 * 0.7
  };

  // 标准化混合向量
  const blend1Len =
    Math.sqrt(blend1.x * blend1.x + blend1.y * blend1.y) || 0.001;
  const blend2Len =
    Math.sqrt(blend2.x * blend2.x + blend2.y * blend2.y) || 0.001;

  const norm1 = {
    x: blend1.x / blend1Len,
    y: blend1.y / blend1Len
  };

  const norm2 = {
    x: blend2.x / blend2Len,
    y: blend2.y / blend2Len
  };

  // 计算最终的控制点坐标
  // 第一个控制点从p1出发，沿着混合方向1
  // 第二个控制点从p2出发，沿着混合方向2的反方向
  const cp1x = p1.x + norm1.x * ctrl1Len;
  const cp1y = p1.y + norm1.y * ctrl1Len;
  const cp2x = p2.x - norm2.x * ctrl2Len;
  const cp2y = p2.y - norm2.y * ctrl2Len;

  return {
    cp1x,
    cp1y,
    cp2x,
    cp2y
  }
}

/**
 * 计算笔画终点段的三次贝塞尔曲线控制点
 *
 * 专为笔画的首尾段设计的控制点计算方法：
 * 1. 考虑终点的特殊性，适当缩短控制点距离
 * 2. 在急转弯处增强曲率补偿
 * 3. 结合速度和角度信息，微调控制点位置
 *
 * 这种方法能使笔画在开始和结束时都具有自然的过渡效果。
 *
 * @param {Object} prev - 前一个点 {x, y}
 * @param {Object} curr - 当前点 {x, y}（曲线起点）
 * @param {Object} next - 下一个点 {x, y}（曲线终点）
 * @param {Object} options - 控制参数
 * @param {number} options.momentumFactor - 动量因子
 * @param {number} options.speedThreshold - 速度阈值
 * @param {number} options.endFactor - 终点控制点因子
 * @param {boolean} options.isLastSegment - 是否为笔画的最后一段
 * @returns {Object} 两个控制点坐标 {cp1x, cp1y, cp2x, cp2y}
 */
function getFinalSegmentControlPoints(prev, curr, next, options = {}) {
  // 计算动量向量
  const v1x = curr.x - prev.x;
  const v1y = curr.y - prev.y;
  const v2x = next.x - curr.x;
  const v2y = next.y - curr.y;

  // 向量长度
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 0.001;
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 0.001;

  // 单位向量
  const u1x = v1x / len1;
  const u1y = v1y / len1;
  const u2x = v2x / len2;
  const u2y = v2y / len2;

  // 计算点积，判断角度变化
  const dotProduct = u1x * u2x + u1y * u2y;

  // 转弯角度因子
  const curvatureFactor = Math.max(0, 1 - dotProduct);

  // 根据速度和角度动态调整控制点长度
  const speedFactor = Math.min(1, len2 / (options.speedThreshold || 30));
  const baseMomentum = options.momentumFactor || 0.4;

  // 检测是否是笔画的最后一段
  const isLastSegment = options.isLastSegment === true;

  // 第一个控制点 - 增强曲率补偿
  // 在急转弯处使用更长的控制点距离
  let cp1Momentum = baseMomentum * (1 + curvatureFactor + speedFactor * 0.5);

  // 如果是最后一段，根据速度动态调整动量，避免"甩尾"
  if (isLastSegment) {
    // 速度越慢，终点动量越小，减少甩尾现象
    const speedReductionFactor = Math.max(0.2, Math.min(1, len2 / 10));
    cp1Momentum *= speedReductionFactor;

    // 如果终点与前一段接近共线，则进一步减少曲率
    if (dotProduct > 0.7) {
      cp1Momentum *= 0.7;
    }
  }

  // 混合两个方向的向量以获得更平滑的过渡
  // 在转弯处更偏向于前一段的方向
  const blendFactor = Math.min(1, Math.max(0, (1 + dotProduct) / 1.5));
  const blendX = u1x * (1 - blendFactor * 0.5) + u2x * blendFactor * 0.5;
  const blendY = u1y * (1 - blendFactor * 0.5) + u2y * blendFactor * 0.5;

  // 标准化混合向量
  const blendLen = Math.sqrt(blendX * blendX + blendY * blendY) || 0.001;
  const normalizedBlendX = blendX / blendLen;
  const normalizedBlendY = blendY / blendLen;

  // 控制点长度
  const cp1Len = len2 * cp1Momentum;

  // 第一个控制点 - 使用混合方向
  const cp1x = curr.x + normalizedBlendX * cp1Len;
  const cp1y = curr.y + normalizedBlendY * cp1Len;

  // 第二个控制点 - 靠近终点，但根据曲率调整
  // 在急转弯处，第二个控制点离终点更近
  let endFactor = options.endFactor || 0.15;

  // 最后一段特殊处理，让第二个控制点更靠近终点
  if (isLastSegment) {
    endFactor *= 0.7;
  }

  const cp2Factor = endFactor * (1 - curvatureFactor * 0.5);
  const cp2x = next.x - v2x * cp2Factor;
  const cp2y = next.y - v2y * cp2Factor;

  return { cp1x, cp1y, cp2x, cp2y }
}

/**
 * CanvasRenderer类
 * 负责在Canvas上渲染笔画，是最终绘制内容的渲染器
 *
 * 渲染过程采用多种贝塞尔曲线插值算法，使笔画呈现平滑、自然的效果。
 * 根据设备性能和笔画复杂度，可以动态在高质量和优化渲染模式间切换。
 */
class CanvasRenderer {
  /**
   * 创建CanvasRenderer实例
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D绘图上下文
   * @param {number} dpr - 设备像素比，用于高分辨率屏幕
   * @param {Object} options - 渲染配置选项
   */
  constructor(ctx, dpr = 1, options = {}) {
    this.ctx = ctx;
    this.dpr = dpr;
    this.minPointsForCurve = 3;
    this.lowFPS = options.lowFPS ?? false; // 是否使用低帧率优化模式
    this.smoothSteps = options.smoothSteps ?? 4; // 平滑插值步数
    // 增加额外的控制参数以匹配预览渲染的质量
    this.angleThreshold = options.angleThreshold ?? 0.06; // 角度变化阈值，较小的值保留更多的角度变化点
    this.distanceThreshold = options.distanceThreshold ?? 6; // 距离阈值，较小的值保留更多点
    this.momentumFactor = options.momentumFactor ?? 0.5; // 贝塞尔曲线动量因子，影响曲线的"惯性"
    this.curveFactor = options.curveFactor ?? 0.35; // 曲线平滑因子，值越大曲线越圆滑
  }

  /**
   * 清除画布内容
   * @param {number} width - 画布宽度
   * @param {number} height - 画布高度
   */
  clearCanvas(width, height) {
    this.ctx.clearRect(0, 0, width / this.dpr, height / this.dpr);
  }

  /**
   * 渲染多个笔画
   * @param {Array<Stroke>} strokes - 笔画对象数组
   */
  renderStrokes(strokes) {
    for (const stroke of strokes) {
      this.renderStroke(stroke);
    }
  }

  /**
   * 渲染单个笔画
   *
   * 根据笔画的点数量和当前性能模式选择合适的渲染方法:
   * - 单点处理: 渲染为圆点
   * - 低帧率/点数多: 使用优化的渲染方式
   * - 普通情况: 使用高质量渲染
   *
   * @param {Stroke} stroke - 要渲染的笔画对象
   */
  renderStroke(stroke) {
    const points = stroke.points;
    const pressures = stroke.pressures;
    if (points.length < 2) return

    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";
    this.ctx.strokeStyle = stroke.color;

    // 单点处理 - 绘制为一个圆点
    if (points.length === 1) {
      this.ctx.beginPath();
      this.ctx.arc(
        points[0].x,
        points[0].y,
        stroke.baseSize * 0.5,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
      this.ctx.restore();
      return
    }

    // 低帧率模式下使用更优化的渲染方式，但保持较高的质量
    if (this.lowFPS && points.length > 10) {
      this._renderOptimizedStroke(stroke, points, pressures);
    } else {
      this._renderHighQualityStroke(stroke, points, pressures);
    }

    this.ctx.restore();
  }

  /**
   * 渲染优化版本的笔画
   *
   * 在低帧率模式下使用，通过减少处理的点数量来提高性能，同时保持平滑视觉效果:
   * 1. 对原始点进行智能采样，保留关键点
   * 2. 重新计算采样点的压力值
   * 3. 使用贝塞尔曲线渲染平滑路径
   *
   * @param {Stroke} stroke - 笔画对象
   * @param {Array<{x,y}>} points - 原始点数组
   * @param {Array<number>} pressures - 原始压力值数组
   * @private
   */
  _renderOptimizedStroke(stroke, points, pressures) {
    // 优化的点采样策略 - 减少过度简化，保留更多关键点
    const simplifiedPoints = this._sampleKeyPoints(points);
    const simplifiedPressures = this._resamplePressures(
      pressures,
      points,
      simplifiedPoints
    );

    // 至少需要2个点才能画线
    if (simplifiedPoints.length < 2) return

    this.ctx.beginPath();
    this._renderSmoothedPath(simplifiedPoints, simplifiedPressures, stroke);
  }

  /**
   * 智能采样关键点算法
   *
   * 根据以下策略选择性保留点:
   * 1. 角度变化显著的点（转弯点）
   * 2. 与上一个点距离超过阈值的点
   * 3. 确保连续点之间不会跳过太多原始点
   *
   * 这种采样可以大幅减少点数量，同时保留笔画的关键形状特征
   *
   * @param {Array<{x,y}>} points - 原始点数组
   * @returns {Array<{x,y}>} 采样后的点数组
   * @private
   */
  _sampleKeyPoints(points) {
    if (points.length <= 3) return [...points]

    const result = [points[0]];
    let lastAddedIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[lastAddedIndex];
      const curr = points[i];
      const next = points[i + 1];

      // 计算当前点与上一个添加点的距离
      const distFromLast = Math.sqrt(
        Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
      );

      // 计算方向变化
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001;
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001;

      // 归一化向量
      const u1 = { x: v1.x / len1, y: v1.y / len1 };
      const u2 = { x: v2.x / len2, y: v2.y / len2 };

      // 计算点积，判断角度变化
      const dotProduct = u1.x * u2.x + u1.y * u2.y;
      const angleChange = Math.acos(Math.max(-1, Math.min(1, dotProduct)));

      // 根据曲率调整距离阈值 - 曲率大时降低阈值保留更多点
      const curvatureAdaptiveThreshold =
        this.distanceThreshold * (0.2 + 0.8 * Math.min(1, (1 + dotProduct) / 2));

      // 保留点的条件更宽松，确保曲线更平滑
      if (
        angleChange > this.angleThreshold || // 角度变化大于阈值
        distFromLast > curvatureAdaptiveThreshold || // 距离大于自适应阈值
        i - lastAddedIndex > 4 // 最多跳过4个点
      ) {
        result.push(curr);
        lastAddedIndex = i;
      }
    }

    // 添加最后一个点
    if (lastAddedIndex < points.length - 1) {
      result.push(points[points.length - 1]);
    }

    return result
  }

  /**
   * 重新采样压力值
   *
   * 根据采样后的点，从原始点集中找出最接近的点并获取其压力值
   * 这确保了即使点被减少，压力变化的特征仍然保持
   *
   * @param {Array<number>} pressures - 原始压力值数组
   * @param {Array<{x,y}>} originalPoints - 原始点数组
   * @param {Array<{x,y}>} sampledPoints - 采样后的点数组
   * @returns {Array<number>} 采样后的压力值数组
   * @private
   */
  _resamplePressures(pressures, originalPoints, sampledPoints) {
    if (originalPoints.length !== pressures.length) {
      // 压力值和点不匹配时的简单处理
      return sampledPoints.map(() => 0.5)
    }

    const result = [];

    // 启发式搜索优化：
    // 1. 假设大多数采样点与原始点的顺序关系保持一致
    // 2. 从上一个找到的最近点开始搜索，而不是每次都从头开始
    // 3. 使用局部窗口搜索，大幅减少计算量

    let lastFoundIndex = 0;
    const searchWindowSize = Math.min(20, Math.ceil(originalPoints.length / 4)); // 动态窗口大小

    for (const point of sampledPoints) {
      let minDist = Infinity;
      let closestIndex = lastFoundIndex;

      // 定义搜索窗口范围
      const startIdx = Math.max(0, lastFoundIndex - searchWindowSize);
      const endIdx = Math.min(
        originalPoints.length - 1,
        lastFoundIndex + searchWindowSize
      );

      // 在窗口内搜索最近点
      for (let i = startIdx; i <= endIdx; i++) {
        const dist = Math.sqrt(
          Math.pow(point.x - originalPoints[i].x, 2) +
            Math.pow(point.y - originalPoints[i].y, 2)
        );

        if (dist < minDist) {
          minDist = dist;
          closestIndex = i;
        }
      }

      // 如果窗口边缘点最近，扩大搜索范围再检查一次
      if (closestIndex === startIdx || closestIndex === endIdx) {
        const extendedStart = Math.max(0, startIdx - searchWindowSize);
        const extendedEnd = Math.min(
          originalPoints.length - 1,
          endIdx + searchWindowSize
        );

        // 只搜索扩展的部分
        const searchStart = closestIndex === startIdx ? extendedStart : startIdx;
        const searchEnd = closestIndex === endIdx ? extendedEnd : endIdx;

        for (let i = searchStart; i <= searchEnd; i++) {
          // 跳过已经搜索过的窗口
          if (i >= startIdx && i <= endIdx) continue

          const dist = Math.sqrt(
            Math.pow(point.x - originalPoints[i].x, 2) +
              Math.pow(point.y - originalPoints[i].y, 2)
          );

          if (dist < minDist) {
            minDist = dist;
            closestIndex = i;
          }
        }
      }

      lastFoundIndex = closestIndex;
      result.push(pressures[closestIndex] || 0.5);
    }

    return result
  }

  /**
   * 渲染平滑路径
   *
   * 使用贝塞尔曲线算法渲染平滑的路径:
   * - 两点: 直接连线
   * - 三点: 使用二次贝塞尔曲线
   * - 四点或更多: 使用不同策略的三次贝塞尔曲线
   *   - 急转弯: 特殊处理保持锐利的转角
   *   - 起始/结束段: 使用终点段处理
   *   - 中间段: 使用四点动量控制的贝塞尔曲线
   *
   * @param {Array<{x,y}>} points - 点数组
   * @param {Array<number>} pressures - 压力值数组
   * @param {Stroke} stroke - 笔画对象
   * @private
   */
  _renderSmoothedPath(points, pressures, stroke) {
    if (points.length < 2) return

    this.ctx.moveTo(points[0].x, points[0].y);

    // 设置第一个线宽
    const firstPressure = pressures[0] || 0.5;
    this.ctx.lineWidth = stroke.baseSize * (0.5 + firstPressure);

    // 如果只有两个点，直接连线
    if (points.length === 2) {
      this.ctx.lineTo(points[1].x, points[1].y);
      this.ctx.stroke();
      return
    }

    // 使用贝塞尔曲线绘制连续的点
    let i = 0;
    while (i < points.length - 1) {
      // 根据可用点的数量选择不同的曲线绘制策略
      const remainingPoints = points.length - i;

      // 更新线宽
      const pressure = pressures[i] || 0.5;
      this.ctx.lineWidth = stroke.baseSize * (0.5 + pressure);

      // 只剩下两个点 - 直接连线
      if (remainingPoints === 2) {
        this.ctx.lineTo(points[i + 1].x, points[i + 1].y);
        break
      }
      // 有三个点 - 使用二次贝塞尔曲线
      else if (remainingPoints === 3) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const p2 = points[i + 2];

        // 使用动量控制点计算
        const cp = getMomentumControlPoint(p0, p1, p2, {
          momentumFactor: this.momentumFactor
        });

        this.ctx.quadraticCurveTo(cp.cx, cp.cy, p2.x, p2.y);
        break
      }
      // 至少四个点 - 可以使用三次贝塞尔曲线
      else {
        const p0 = points[i];
        const p1 = points[i + 1];
        const p2 = points[i + 2];
        const p3 = points[i + 3];

        // 检测是否是急转弯 - 使用Vec2工具简化代码
        const v1 = Vec2.fromPoints(p1, p2);
        const v2 = Vec2.fromPoints(p2, p3);
        const u1 = Vec2.normalize(v1);
        const u2 = Vec2.normalize(v2);
        const dot = Vec2.dot(u1, u2);

        // 检测是否是最后一段（用于特殊终点处理）
        const isLastSegment = i >= points.length - 4;

        // 急转弯特殊处理
        if (dot < 0) {
          const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
            p0,
            p1,
            p2,
            {
              momentumFactor: this.momentumFactor,
              speedThreshold: 20,
              endFactor: 0.2,
              isLastSegment
            }
          );

          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          i += 2; // 向前推进两个点
        }
        // 常规连续曲线段
        else if (i === 0 || i === points.length - 4) {
          // 第一段或最后一段使用终点段处理
          const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
            p0,
            p1,
            p2,
            {
              momentumFactor: 0.4,
              speedThreshold: 25,
              endFactor: 0.15,
              isLastSegment // 传递是否是最后一段的标志
            }
          );

          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          i += 2; // 向前推进两个点
        }
        // 中间段使用四点贝塞尔曲线
        else {
          const { cp1x, cp1y, cp2x, cp2y } = getCubicMomentumControlPoints(
            p0,
            p1,
            p2,
            p3,
            {
              controlFactor: this.curveFactor,
              speedThreshold: 25
            }
          );

          this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          i += 2; // 向前推进两个点
        }
      }
    }

    this.ctx.stroke();
  }

  /**
   * 高质量笔画渲染
   *
   * 不进行点采样，使用全部原始点以获得最高质量的渲染效果
   * 适用于性能良好或笔画点数较少的情况
   *
   * @param {Stroke} stroke - 笔画对象
   * @param {Array<{x,y}>} points - 点数组
   * @param {Array<number>} pressures - 压力值数组
   * @private
   */
  _renderHighQualityStroke(stroke, points, pressures) {
    // 高质量模式 - 使用更多的点采样和更平滑的曲线
    if (points.length <= 1) {
      // 单点处理
      if (points.length === 1) {
        this.ctx.beginPath();
        this.ctx.arc(
          points[0].x,
          points[0].y,
          stroke.baseSize * 0.5,
          0,
          Math.PI * 2
        );
        this.ctx.fill();
      }
      return
    }

    // 对于简单的两点情况，直接连线
    if (points.length === 2) {
      this.ctx.beginPath();
      this.ctx.moveTo(points[0].x, points[0].y);
      this.ctx.lineTo(points[1].x, points[1].y);

      const width = stroke.baseSize * (0.5 + (pressures[0] || 0.5));
      this.ctx.lineWidth = width;
      this.ctx.stroke();
      return
    }

    // 高质量模式下不进行点采样，使用全部点以获得最平滑的曲线
    this.ctx.beginPath();
    this._renderSmoothedPath(points, pressures, stroke);
  }
}

class PreviewRenderer {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.minPointsForCurve = 3;
    this.smoothSteps = options.smoothSteps ?? 4;
    this.lowFPS = options.lowFPS ?? false;
  }

  renderPreviewSegment(stroke) {
    const points = stroke.points;
    const pressures = stroke.pressures;
    if (points.length < this.minPointsForCurve) return

    this.ctx.save();
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalCompositeOperation =
      stroke.tool === "eraser" ? "destination-out" : "source-over";

    // 低帧率模式：使用简化的渲染方式
    if (this.lowFPS) {
      this._renderSimplifiedPreview(points, pressures, stroke);
    } else {
      this._renderDetailedPreview(points, pressures, stroke);
    }

    this.ctx.restore();
  }

  _renderSimplifiedPreview(points, pressures, stroke) {
    // 简化版本但确保与CanvasRenderer._renderLowFPSStroke算法一致
    if (points.length < 3) {
      // 点不足时使用简单线段
      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];
      const pr2 = pressures[pressures.length - 1] || 0.5;

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);

      const width = stroke.baseSize * (0.5 + pr2);
      this.ctx.strokeStyle = stroke.color;
      this.ctx.lineWidth = width;
      this.ctx.stroke();
      return
    }

    // 数据准备 - 获取足够多的点以生成更平滑的曲线
    // 保持与CanvasRenderer一致的点数处理策略
    const numPoints = Math.min(points.length, 7);
    const pointsToUse = points.slice(-numPoints); // 取最后几个点
    const pressuresToUse = pressures.slice(-numPoints);

    this.ctx.beginPath();

    // 如果只有三个点，使用二次贝塞尔曲线 - 与CanvasRenderer一致
    if (pointsToUse.length === 3) {
      const p0 = pointsToUse[0];
      const p1 = pointsToUse[1];
      const p2 = pointsToUse[2];

      // 使用共享的动量控制点计算函数 - 确保参数与CanvasRenderer一致
      const cp = getMomentumControlPoint(p0, p1, p2, {
        momentumFactor: 0.5 // 与CanvasRenderer一致
      });

      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.quadraticCurveTo(cp.cx, cp.cy, p2.x, p2.y);
    }
    // 更多点时使用与CanvasRenderer一致的处理
    else if (pointsToUse.length >= 4) {
      // 获取最后几个点
      const n = pointsToUse.length;
      pointsToUse[n - 4 >= 0 ? n - 4 : 0];
      const p1 = pointsToUse[n - 3];
      const p2 = pointsToUse[n - 2];
      const p3 = pointsToUse[n - 1];

      // 检测是否是急转弯 - 与CanvasRenderer使用完全相同的检测
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 0.001;
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 0.001;
      const u1 = { x: v1.x / len1, y: v1.y / len1 };
      const u2 = { x: v2.x / len2, y: v2.y / len2 };
      const dot = u1.x * u2.x + u1.y * u2.y;

      // 使用与CanvasRenderer完全相同的转弯处理逻辑
      this.ctx.moveTo(p2.x, p2.y);

      if (dot < 0) {
        // 转弯角度大于90度
        // 急转弯特殊处理 - 与CanvasRenderer使用相同参数
        const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
          p1,
          p2,
          p3,
          {
            momentumFactor: 0.5, // 与CanvasRenderer一致
            speedThreshold: 20,
            endFactor: 0.2 // 与CanvasRenderer一致
          }
        );

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
      } else {
        // 正常曲线 - 与CanvasRenderer使用相同参数
        const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
          p1,
          p2,
          p3,
          {
            momentumFactor: 0.4, // 与CanvasRenderer一致
            speedThreshold: 25,
            endFactor: 0.15 // 与CanvasRenderer一致
          }
        );

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p3.x, p3.y);
      }
    }

    // 设置线宽和颜色
    const pr1 = pressuresToUse[pressuresToUse.length - 2] || 0.5;
    const pr2 = pressuresToUse[pressuresToUse.length - 1] || 0.5;
    const avgWidth = stroke.baseSize * (0.5 + (pr1 + pr2) / 2);

    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = avgWidth;
    this.ctx.stroke();
  }

  _renderDetailedPreview(points, pressures, stroke) {
    // 高质量渲染方式 - 使用与CanvasRenderer._renderHighQualityStroke一致的算法
    if (points.length < 3) {
      if (points.length === 2) {
        // 只有两个点时使用直线
        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];
        const pr1 = pressures[pressures.length - 2] || 0.5;

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);

        const width = stroke.baseSize * (0.5 + pr1);
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = width;
        this.ctx.stroke();
      }
      return
    }

    // 处理最近的几个点
    const n = Math.min(points.length, 5); // 限制处理点数，避免性能问题
    const pointsToUse = points.slice(-n);
    const pressuresToUse = pressures.slice(-n);

    this.ctx.beginPath();

    // 第一个点
    this.ctx.moveTo(pointsToUse[0].x, pointsToUse[0].y);

    // 使用与CanvasRenderer一致的贝塞尔曲线绘制
    for (let i = 1; i < pointsToUse.length - 1; i++) {
      const p0 = i > 1 ? pointsToUse[i - 2] : pointsToUse[i - 1];
      const p1 = pointsToUse[i - 1];
      const p2 = pointsToUse[i];
      i < pointsToUse.length - 2 ? pointsToUse[i + 1] : pointsToUse[i];

      // 设置线宽
      const pressure = pressuresToUse[i - 1] || 0.5;
      const width = stroke.baseSize * (0.5 + pressure);
      this.ctx.lineWidth = width;

      // 使用与CanvasRenderer一致的控制点计算
      if (i === 1) {
        // 第一段使用二次贝塞尔曲线
        const cp = getMomentumControlPoint(p0, p1, p2, {
          momentumFactor: 0.4 // 与CanvasRenderer一致
        });
        this.ctx.quadraticCurveTo(cp.cx, cp.cy, p2.x, p2.y);
      } else {
        // 其他段使用三次贝塞尔曲线
        const { cp1x, cp1y, cp2x, cp2y } = getFinalSegmentControlPoints(
          p0,
          p1,
          p2,
          {
            momentumFactor: 0.4, // 与CanvasRenderer一致
            speedThreshold: 25,
            endFactor: 0.15
          }
        );

        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    }

    this.ctx.strokeStyle = stroke.color;
    this.ctx.stroke();
  }

  drawStartPoint(pos, tool = "pen", radius = 1.5) {
    this.ctx.save();
    if (tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out";
    }

    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = tool === "eraser" ? "rgba(0,0,0,1)" : "black";
    this.ctx.fill();
    this.ctx.restore();
  }
}

// src/logger/Logger.js

/**
 * Logger：统一的日志系统，支持分级输出。
 */
class Logger {
  /**
   * @param {string} moduleName - 模块名称，用于日志前缀
   * @param {'debug'|'info'|'warn'|'error'} level - 最低输出级别
   */
  constructor(moduleName = "DrawingBoard", level = "info") {
    this.moduleName = moduleName;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.level = level;
    this.enabled = true;
  }

  /**
   * 设置日志等级
   * @param {string} level
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.level = level;
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

    const prefix = `[${this.moduleName}][${type.toUpperCase()}]`;
    if (data !== undefined) {
      try {
        console.log(
          prefix,
          message,
          typeof data === "object" ? JSON.stringify(data) : data
        );
      } catch {
        console.log(prefix, message, String(data));
      }
    } else {
      console.log(prefix, message);
    }
  }

  debug(msg, data) {
    this.log("debug", msg, data);
  }

  info(msg, data) {
    this.log("info", msg, data);
  }

  warn(msg, data) {
    this.log("warn", msg, data);
  }

  error(msg, data) {
    this.log("error", msg, data);
  }

  /**
   * 启用或禁用日志
   * @param {boolean} state
   */
  setEnabled(state) {
    this.enabled = state;
  }
}

// src/logger/PerformanceMonitor.js

/**
 * PerformanceMonitor：记录绘图相关性能指标
 */
class PerformanceMonitor {
  constructor(logger = null) {
    this.logger = logger;
    this.frameRates = [];
    this.renderTimes = [];
    this.droppedFrames = 0;
    this._frameCount = 0;
    this._lastFrameTime = performance.now();
    this._active = false;
    this._fpsCallbacks = [];
    this._lastFpsCheck = 0;
    this._checkInterval = 2000;
    this._currentFps = 60;
  }

  /**
   * 注册FPS变化的回调函数
   * @param {function} callback - 当FPS变化时调用的回调，参数为当前FPS
   */
  onFpsChange(callback) {
    if (typeof callback === "function") {
      this._fpsCallbacks.push(callback);
    }
  }

  /**
   * 启动帧率监控（每秒更新一次）
   */
  start() {
    if (this._active) return
    this._active = true;

    const loop = () => {
      const now = performance.now();
      const delta = now - this._lastFrameTime;
      this._frameCount++;

      if (delta >= 1000) {
        const fps = Math.round((this._frameCount * 1000) / delta);
        this.frameRates.push(fps);
        this._currentFps = fps;

        if (fps < 30) {
          this.droppedFrames++;
          this.logger?.warn("低帧率检测", { fps });
        }

        if (now - this._lastFpsCheck > this._checkInterval) {
          this._lastFpsCheck = now;
          this._notifyFpsCallbacks(fps);
        }

        this._frameCount = 0;
        this._lastFrameTime = now;
      }

      if (this._active) {
        requestAnimationFrame(loop);
      }
    };

    requestAnimationFrame(loop);
  }

  /**
   * 通知所有FPS变化回调
   * @private
   */
  _notifyFpsCallbacks(fps) {
    for (const callback of this._fpsCallbacks) {
      try {
        callback(fps);
      } catch (e) {
        this.logger?.error("FPS回调异常", e);
      }
    }
  }

  /**
   * 获取当前估计的FPS
   */
  getCurrentFps() {
    return this._currentFps
  }

  /**
   * 停止监控
   */
  stop() {
    this._active = false;
  }

  /**
   * 手动记录一次渲染耗时
   * @param {function} renderFn - 执行渲染的函数
   */
  measureRender(renderFn) {
    const start = performance.now();
    renderFn();
    const end = performance.now();
    const duration = end - start;
    this.renderTimes.push(duration);

    if (duration > 33) {
      this.logger?.warn("渲染延迟过高", { duration });
    }
  }

  /**
   * 导出分析数据
   */
  exportMetrics() {
    return {
      frameRates: this.frameRates,
      renderTimes: this.renderTimes,
      droppedFrames: this.droppedFrames,
      avgFps:
        this.frameRates.length > 0
          ? this.frameRates.reduce((a, b) => a + b) / this.frameRates.length
          : 0,
      avgRender:
        this.renderTimes.length > 0
          ? this.renderTimes.reduce((a, b) => a + b) / this.renderTimes.length
          : 0
    }
  }
}

// src/logger/StrokeAnalytics.js

/**
 * StrokeAnalytics：笔画行为分析器，记录用户绘制习惯。
 */
class StrokeAnalytics {
  constructor(logger = null) {
    this.logger = logger;

    this.strokeCount = 0;
    this.totalPoints = 0;
    this.averagePoints = 0;
    this.strokeDurations = [];
    this.directionChanges = 0;
  }

  /**
   * 记录一次笔画信息
   * @param {import('../tools/Stroke.js').Stroke} stroke
   */
  track(stroke) {
    const pointCount = stroke.points.length;
    const duration = Date.now() - stroke.timestamp;

    // 分析方向变化
    let directionChanges = 0;
    if (pointCount > 2) {
      for (let i = 2; i < pointCount; i++) {
        const p0 = stroke.points[i - 2];
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];

        const dx1 = p1.x - p0.x;
        const dy1 = p1.y - p0.y;
        const dx2 = p2.x - p1.x;
        const dy2 = p2.y - p1.y;

        const dot = dx1 * dx2 + dy1 * dy2;
        const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        if (mag1 > 0 && mag2 > 0) {
          const cosAngle = dot / (mag1 * mag2);
          if (cosAngle < 0.866) directionChanges++;
        }
      }
    }

    // 更新整体统计
    this.strokeCount++;
    this.totalPoints += pointCount;
    this.averagePoints = this.totalPoints / this.strokeCount;
    this.strokeDurations.push(duration);
    this.directionChanges += directionChanges;

    // 可选：记录日志
    this.logger?.info("笔画完成", {
      points: pointCount,
      duration: duration + "ms",
      directionChanges,
      averagePressure:
        stroke.pressures.reduce((a, b) => a + b, 0) / stroke.pressures.length
    });
  }

  /**
   * 导出分析数据
   */
  exportStats() {
    return {
      strokeCount: this.strokeCount,
      totalPoints: this.totalPoints,
      averagePoints: this.averagePoints,
      totalDirectionChanges: this.directionChanges,
      averageDuration:
        this.strokeDurations.length > 0
          ? this.strokeDurations.reduce((a, b) => a + b) /
            this.strokeDurations.length
          : 0
    }
  }
}

/**
 * 轨迹平滑器（PathSmoother）
 *
 * 用于实时平滑输入点，减少手部抖动和设备噪声的影响，使绘制的线条更加平滑自然。
 * 该平滑器在用户绘制过程中实时处理每个输入点，而不是在完成笔画后再处理。
 *
 * 主要功能：
 * 1. 基于历史点的加权平均进行平滑
 * 2. 速度感知平滑（快速移动时减少平滑强度）
 * 3. 抖动检测和消除
 * 4. 动态调整平滑参数
 */
class PathSmoother {
  /**
   * 创建一个轨迹平滑器实例
   *
   * @param {Object} options - 平滑器配置选项
   * @param {number} [options.factor=0.5] - 平滑因子（0-1之间），值越大平滑效果越强，但响应越滞后
   * @param {boolean} [options.enabled=true] - 是否启用平滑
   * @param {number} [options.historySize=4] - 历史点的保留数量，用于计算平滑
   * @param {boolean} [options.velocitySmoothing=false] - 是否启用速度感知平滑
   * @param {number} [options.jitterThreshold=2.0] - 抖动检测阈值（像素），小于此值的移动可能被视为抖动
   * @param {number} [options.accelerationThreshold=0.3] - 加速度阈值，用于检测速度突变抖动
   */
  constructor(options = {}) {
    // 平滑因子，值越大平滑效果越强（0-1之间）
    this.factor = options.factor || 0.5;
    // 是否启用平滑
    this.enabled = options.enabled !== false;
    // 最近的点记录，用于计算平滑
    this.lastPoints = [];
    // 历史点的保留数量
    this.historySize = options.historySize || 4;
    // 速度平滑
    this.velocitySmoothing = options.velocitySmoothing || false;
    // 抖动阈值
    this.jitterThreshold = options.jitterThreshold || 2.0;
    // 加速度阈值 - 用于检测速度突变
    this.accelerationThreshold = options.accelerationThreshold || 0.3;
    // 上一次处理时间
    this._lastTime = 0;
    // 速度历史
    this._velocities = [];
    // 方向历史 - 用于检测方向变化
    this._directions = [];
    // 抖动连续计数 - 用于累积抖动检测结果
    this._jitterCount = 0;
  }

  /**
   * 平滑一个输入点
   *
   * 核心算法是基于加权平均的平滑，同时考虑速度和抖动因素：
   * - 对于快速移动，减少平滑以保持响应性
   * - 对于检测到的抖动，增强平滑以消除噪声
   * - 对于正常移动，使用标准平滑
   *
   * @param {Object} point - 输入点 {x, y}
   * @returns {Object} 平滑后的点 {x, y}
   */
  smooth(point) {
    // 如果平滑被禁用，直接返回原始点
    if (!this.enabled) {
      return point
    }

    // 第一个点没有历史数据，直接记录并返回
    if (this.lastPoints.length === 0) {
      this.lastPoints.push({ ...point, timestamp: Date.now() });
      this._lastTime = Date.now();
      return point
    }

    // 计算时间差，用于速度计算
    const now = Date.now();
    const deltaTime = Math.max(1, now - this._lastTime);
    this._lastTime = now;

    const lastPoint = this.lastPoints[this.lastPoints.length - 1];

    // 抖动检测和过滤 - 需要至少两个历史点
    if (this.lastPoints.length >= 2) {
      // 计算当前点与最后一个历史点的距离
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 计算速度 (像素/毫秒)
      const velocity = dist / deltaTime;
      this._velocities.push(velocity);

      // 保持速度历史长度上限为3
      if (this._velocities.length > 3) {
        this._velocities.shift();
      }

      // 计算平均速度，用于速度感知平滑
      const avgVelocity =
        this._velocities.reduce((a, b) => a + b, 0) / this._velocities.length;

      // 计算当前移动方向并保存
      if (dist > 0.001) {
        const direction = { x: dx / dist, y: dy / dist };
        this._directions.push(direction);
        if (this._directions.length > 3) {
          this._directions.shift();
        }
      }

      // 改进的抖动检测 - 使用多种指标
      let isJitter = false;

      // 1. 小距离移动检测
      const smallMovement = dist < this.jitterThreshold;

      // 2. 方向一致性检测 - 方向变化频繁说明可能是抖动
      let directionChange = 0;
      if (this._directions.length >= 2) {
        for (let i = 1; i < this._directions.length; i++) {
          const prevDir = this._directions[i - 1];
          const currDir = this._directions[i];
          // 计算方向点积 (1=相同方向，-1=相反方向)
          const dirDot = prevDir.x * currDir.x + prevDir.y * currDir.y;
          // 累积方向变化量
          directionChange += 1 - dirDot; // 0=没变化，2=完全反向
        }
        // 平均方向变化
        directionChange /= this._directions.length - 1;
      }

      // 3. 速度突变检测 - 速度快速波动也是抖动特征
      let velocityVariation = 0;
      if (this._velocities.length >= 2) {
        for (let i = 1; i < this._velocities.length; i++) {
          const ratio = this._velocities[i] / (this._velocities[i - 1] || 0.001);
          // 记录加速或减速比例
          velocityVariation += Math.abs(1 - ratio);
        }
        velocityVariation /= this._velocities.length - 1;
      }

      // 综合判断是否是抖动
      // 小距离移动 + (方向变化大 或 速度波动大)
      if (
        smallMovement &&
        (directionChange > 0.8 ||
          velocityVariation > this.accelerationThreshold)
      ) {
        isJitter = true;
        this._jitterCount++;
      } else {
        // 逐渐减少抖动计数
        this._jitterCount = Math.max(0, this._jitterCount - 0.5);
      }

      // 快速移动处理策略：减少平滑强度以保持响应性
      if (avgVelocity > 0.5 && !isJitter) {
        // 根据速度动态调整平滑因子 - 速度越快，平滑越少
        const dynamicFactor = Math.max(0.1, this.factor - avgVelocity * 0.3);
        const smoothedPoint = {
          x: lastPoint.x * dynamicFactor + point.x * (1 - dynamicFactor),
          y: lastPoint.y * dynamicFactor + point.y * (1 - dynamicFactor),
          timestamp: now
        };

        // 更新历史点队列
        this.lastPoints.push(smoothedPoint);
        if (this.lastPoints.length > this.historySize) {
          this.lastPoints.shift();
        }

        return smoothedPoint
      }

      // 抖动处理 - 使用改进的多指标检测
      if (isJitter || this._jitterCount > 1) {
        // 抖动强度取决于累积的抖动计数
        const jitterStrength = Math.min(0.9, 0.6 + this._jitterCount * 0.1);

        // 检测到抖动，增强平滑力度
        const antiJitterFactor = Math.min(
          0.9,
          this.factor + jitterStrength * 0.3
        );
        const smoothedPoint = {
          x: lastPoint.x * antiJitterFactor + point.x * (1 - antiJitterFactor),
          y: lastPoint.y * antiJitterFactor + point.y * (1 - antiJitterFactor),
          timestamp: now
        };

        // 更新历史点队列
        this.lastPoints.push(smoothedPoint);
        if (this.lastPoints.length > this.historySize) {
          this.lastPoints.shift();
        }

        return smoothedPoint
      }
    }

    // 标准情况下的平滑处理
    // 使用当前点和最近历史点的加权平均
    const smoothedPoint = {
      x: lastPoint.x * this.factor + point.x * (1 - this.factor),
      y: lastPoint.y * this.factor + point.y * (1 - this.factor),
      timestamp: now
    };

    // 更新历史点队列
    this.lastPoints.push(smoothedPoint);
    if (this.lastPoints.length > this.historySize) {
      this.lastPoints.shift();
    }

    return smoothedPoint
  }

  /**
   * 重置平滑器状态
   *
   * 在开始新的笔画时调用，清除所有历史数据
   */
  reset() {
    this.lastPoints = [];
    this._velocities = [];
    this._directions = [];
    this._jitterCount = 0;
    this._lastTime = 0;
  }

  /**
   * 设置平滑参数
   *
   * 允许在运行时动态调整平滑器的行为
   *
   * @param {Object} options - 要更新的配置选项
   * @param {number} [options.factor] - 平滑因子
   * @param {boolean} [options.enabled] - 是否启用平滑
   * @param {number} [options.historySize] - 历史点数量
   * @param {boolean} [options.velocitySmoothing] - 速度感知平滑
   * @param {number} [options.jitterThreshold] - 抖动阈值
   * @param {number} [options.accelerationThreshold] - 加速度阈值
   */
  setOptions(options = {}) {
    if (options.factor !== undefined) this.factor = options.factor;
    if (options.enabled !== undefined) this.enabled = options.enabled;
    if (options.historySize !== undefined)
      this.historySize = options.historySize;
    if (options.velocitySmoothing !== undefined)
      this.velocitySmoothing = options.velocitySmoothing;
    if (options.jitterThreshold !== undefined)
      this.jitterThreshold = options.jitterThreshold;
    if (options.accelerationThreshold !== undefined)
      this.accelerationThreshold = options.accelerationThreshold;
  }
}

// src/ui/UIEventBinder.js

/**
 * 绑定 UI 控件事件（按钮 / 滑块 / 模式切换等）
 * @param {Object} opts
 * @param {Object} opts.drawingBoard - 主绘图实例
 * @param {HTMLElement} opts.container - 事件绑定容器（默认 document）
 */
function bindUIEvents({ drawingBoard, container = document }) {
  const tools = ["pen", "eraser", "chalk"];

  const updateSlider = () => {
    const size = drawingBoard.getToolSize();
    sizeSlider.value = size;
    sizeValue.textContent = size;
  };

  tools.forEach((tool) => {
    const btn = container.getElementById(`${tool}-tool`);
    if (btn) {
      btn.addEventListener("click", () => {
        drawingBoard.setTool(tool);
        updateSlider();
      });
    }
  });

  const undoBtn = container.getElementById("undo");
  undoBtn?.addEventListener("click", () => drawingBoard.undo());

  const redoBtn = container.getElementById("redo");
  redoBtn?.addEventListener("click", () => drawingBoard.redo());

  const clearBtn = container.getElementById("clear");
  clearBtn?.addEventListener("click", () => drawingBoard.clear());

  const exportLogsBtn = container.getElementById("export-logs");
  exportLogsBtn?.addEventListener("click", () => drawingBoard.exportLogs());

  const modeBtn = container.getElementById("input-mode-toggle");
  const modeText = container.getElementById("input-mode-text");
  if (modeBtn && modeText) {
    modeBtn.addEventListener("click", () => {
      const mode = drawingBoard.toggleInputMode();
      modeText.textContent = mode === "pen" ? "触控笔模式" : "鼠标模式";
    });
  }

  const sizeSlider = container.getElementById("size-slider");
  const sizeValue = container.getElementById("size-value");
  if (sizeSlider && sizeValue) {
    sizeSlider.addEventListener("input", () => {
      const size = parseInt(sizeSlider.value);
      sizeValue.textContent = size;
      drawingBoard.setToolSize(size);
    });

    updateSlider();
    tools.forEach((tool) => {
      const btn = container.getElementById(`${tool}-tool`);
      btn?.addEventListener("click", updateSlider);
    });
  }

  const exportAnalysisBtn = container.getElementById("export-analysis");
  exportAnalysisBtn?.addEventListener("click", () => {
    const report = drawingBoard.exportDetailedAnalysis?.();
    if (report) {
      const json = JSON.stringify(report, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `drawing-analysis-${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.json`;
      a.click();

      URL.revokeObjectURL(url);
    }
  });

  // 绑定模拟低帧率复选框事件
  const simulateLowFPS = container.getElementById("simulate-lowfps");
  simulateLowFPS?.addEventListener("change", (e) => {
    if (drawingBoard.simulateLowFPS) {
      drawingBoard.simulateLowFPS(e.target.checked);
    } else {
      console.warn("DrawingBoard 中未实现 simulateLowFPS 方法");
    }
  });
}

// src/utils/device.js

/**
 * 获取当前设备的 DPR（设备像素比）
 * @returns {number}
 */
function getDevicePixelRatio() {
  return window.devicePixelRatio || 1
}

/**
 * 测试当前设备的处理性能
 * @param {number} testDuration - 测试时长（毫秒），默认 100ms
 * @returns {Promise<{ score: number, iterations: number }>}
 */
async function measureDevicePerformance(testDuration = 100) {
  const startTime = performance.now();
  let iterations = 0;

  while (performance.now() - startTime < testDuration) {
    iterations++;
  }

  // 将迭代次数映射为性能分数（假设 50 为高性能）
  const score = Math.min(1.0, iterations / 50);
  return { score, iterations }
}

// src/index.js
/**
 * 主类：组合所有子模块
 */
class DrawingBoard {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.dpr = getDevicePixelRatio();
    this.canvas.width = this.canvas.clientWidth * this.dpr;
    this.canvas.height = this.canvas.clientHeight * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    // 初始化模块
    this.logger = new Logger("DrawingBoard", "debug");
    this.toolManager = new ToolManager();
    this.stylusAdapter = new StylusAdapter();
    this.renderer = new CanvasRenderer(this.ctx, this.dpr);
    this.preview = new PreviewRenderer(this.ctx);
    this.monitor = new PerformanceMonitor(this.logger);
    this.analytics = new StrokeAnalytics(this.logger);

    this.strokes = [];
    this.history = [];
    this.historyIndex = -1;
    this.currentStroke = null;

    // 添加帧率控制相关属性
    this._isSimulatingLowFPS = false;
    this._lastFrameTime = 0;
    this._targetFPS = 60; // 默认目标帧率
    this._frameDuration = 1000 / this._targetFPS;

    // 添加轨迹平滑器
    this.smoother = new PathSmoother({
      factor: 0.3,
      historySize: 3,
      enabled: true
    });

    this.inputHandler = new PointerInputHandler(this.canvas, (e) =>
      this.stylusAdapter.mapPressure(e)
    );

    // 关键修复：必须在这里绑定绘图事件，否则无法捕获笔画
    this._bindEvents();
    this.monitor.start();

    this.canvasId = canvasId;
    this.inputMode = "pen";

    // 初始化历史记录 - 添加空白画布状态作为第一个历史记录
    this._saveToHistory();

    this._initRendererAndUI();
  }

  _bindEvents() {
    this.inputHandler.bindEvents({
      onPointerDown: this._onPointerDown.bind(this),
      onPointerMove: this._onPointerMove.bind(this),
      onPointerUp: this._onPointerUp.bind(this)
    });

    // 将UI事件绑定移动到这里的调用会导致重复绑定
    // 因为在_initRendererAndUI中也调用了bindUIEvents
    // bindUIEvents({ drawingBoard: this })
  }

  _onPointerDown(event) {
    const pos = this.inputHandler.getPointerPosition(
      event.clientX,
      event.clientY
    );
    const pressure = this.stylusAdapter.mapPressure(event);

    // 重置平滑器状态
    this.smoother.reset();

    // 第一个点不平滑，直接使用
    const tool = this.toolManager.getCurrentTool();
    const size = this.toolManager.getToolSize();
    this.currentStroke = new Stroke(tool, pos, pressure, size);

    this.preview.drawStartPoint(pos, tool, size / 2);
  }

  _onPointerMove(event) {
    if (!this.currentStroke) return

    // 如果正在模拟低帧率，限制处理频率
    if (this._isSimulatingLowFPS) {
      const now = performance.now();
      const elapsed = now - this._lastFrameTime;

      if (elapsed < this._frameDuration) {
        return // 跳过此次处理，限制帧率
      }

      this._lastFrameTime = now;
    }

    const pos = this.inputHandler.getPointerPosition(
      event.clientX,
      event.clientY
    );

    // 应用平滑策略，低性能模式下使用更强的平滑
    let smoothedPos;
    if (this.lowPerformance) {
      // 低帧率模式：多次平滑以获得更平滑的曲线
      const firstSmooth = this.smoother.smooth(pos);
      const secondSmooth = this.smoother.smooth(firstSmooth);
      smoothedPos = {
        x: (firstSmooth.x + secondSmooth.x) / 2,
        y: (firstSmooth.y + secondSmooth.y) / 2
      };
    } else {
      // 正常模式：单次平滑
      smoothedPos = this.smoother.smooth(pos);
    }

    const pressure = this.stylusAdapter.mapPressure(event);
    this.currentStroke.addPoint(smoothedPos, pressure);

    this.preview.renderPreviewSegment(this.currentStroke);
  }

  _onPointerUp() {
    if (this.currentStroke?.isValid()) {
      this.strokes.push(this.currentStroke);
      this._saveToHistory();
      this.analytics.track(this.currentStroke);
      this.monitor.measureRender(() => {
        this.renderer.clearCanvas(this.canvas.width, this.canvas.height);
        this.renderer.renderStrokes(this.strokes);
      });
    }
    this.currentStroke = null;
  }

  _saveToHistory() {
    const copy = this.strokes.map((s) => s.clone());
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(copy);
    this.historyIndex = this.history.length - 1;

    // 添加调试日志
    this.logger?.debug("保存历史记录", {
      历史索引: this.historyIndex,
      历史记录数: this.history.length,
      当前笔画数: this.strokes.length
    });
  }

  undo() {
    // 完全重新设计撤销功能
    this.logger?.debug("准备撤销", {
      历史索引: this.historyIndex,
      历史记录数: this.history.length,
      当前笔画数: this.strokes.length
    });

    // 修改撤销条件：允许回到索引0（空白画布状态）
    if (this.history.length > 0 && this.historyIndex > 0) {
      // 关键变化：不是修改当前状态，而是回到前一个历史状态
      this.historyIndex--;

      // 从历史记录中恢复笔画状态
      this.strokes = this.history[this.historyIndex].map((s) => s.clone());

      this.logger?.debug("撤销完成", {
        回退到历史索引: this.historyIndex,
        恢复后笔画数: this.strokes.length,
        撤销前索引: this.historyIndex + 1,
        撤销前笔画数: this.history[this.historyIndex + 1].length
      });

      // 重新渲染画布
      this.renderer.clearCanvas(this.canvas.width, this.canvas.height);
      this.renderer.renderStrokes(this.strokes);
    } else {
      this.logger?.debug("无法撤销 - 没有更早的历史记录", {
        历史索引: this.historyIndex,
        历史长度: this.history.length
      });
    }
  }

  redo() {
    this.logger?.debug("准备重做", {
      历史索引: this.historyIndex,
      历史记录数: this.history.length
    });

    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.strokes = this.history[this.historyIndex].map((s) => s.clone());

      this.logger?.debug("重做完成", {
        前进到历史索引: this.historyIndex,
        恢复后笔画数: this.strokes.length
      });

      this.renderer.clearCanvas(this.canvas.width, this.canvas.height);
      this.renderer.renderStrokes(this.strokes);
    } else {
      this.logger?.debug("无法重做 - 已是最新状态", {
        历史索引: this.historyIndex,
        历史长度: this.history.length
      });
    }
  }

  clear() {
    this.strokes = [];
    this._saveToHistory();
    this.renderer.clearCanvas(this.canvas.width, this.canvas.height);
  }

  setTool(tool) {
    this.toolManager.setTool(tool);
  }

  setToolSize(size) {
    this.toolManager.setToolSize(size);
  }

  getToolSize() {
    return this.toolManager.getToolSize()
  }

  toggleInputMode() {
    this.inputMode = this.inputMode === "pen" ? "mouse" : "pen";
    return this.inputMode
  }

  exportLogs() {
    const data = {
      strokes: this.strokes,
      metrics: this.monitor.exportMetrics(),
      behavior: this.analytics.exportStats()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `drawing-log-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    return data
  }

  exportDetailedAnalysis() {
    return {
      ...this.monitor.exportMetrics(),
      ...this.analytics.exportStats()
    }
  }

  // 模拟低帧率模式
  simulateLowFPS(enable) {
    this._isSimulatingLowFPS = enable;
    this._targetFPS = enable ? 24 : 60; // 模拟24FPS的低帧率
    this._frameDuration = 1000 / this._targetFPS;

    // 直接更新渲染器设置
    if (enable) {
      this.lowPerformance = true;
      this.logger?.info("已启用低帧率模式模拟", { targetFPS: this._targetFPS });

      // 更新渲染器设置
      this.renderer.lowFPS = true;
      this.preview.lowFPS = true;
      this.preview.smoothSteps = 2;
      this.renderer.smoothSteps = 2;

      // 增强平滑效果
      this.smoother.setOptions({
        factor: 0.7, // 提高平滑因子
        historySize: 6, // 增加历史点数量
        enabled: true,
        velocitySmoothing: true, // 启用速度感知平滑
        jitterThreshold: 2.5 // 抖动检测阈值
      });
    } else {
      this.lowPerformance = false;
      this.logger?.info("已禁用低帧率模式模拟");

      // 恢复渲染器设置
      this.renderer.lowFPS = false;
      this.preview.lowFPS = false;
      this.preview.smoothSteps = 4;
      this.renderer.smoothSteps = 4;

      // 恢复默认平滑设置
      this.smoother.setOptions({
        factor: 0.3,
        historySize: 3,
        enabled: true,
        velocitySmoothing: false,
        jitterThreshold: 2.0
      });
    }
  }

  async _initRendererAndUI() {
    const { score } = await measureDevicePerformance();
    const fps = this.monitor?.exportMetrics?.().avgFps || 60;

    this.lowPerformance = score < 0.6 || fps < 30;
    this.logger?.info?.("性能评分", { score, fps });

    const smoothSteps = fps < 30 ? 2 : 4;

    this.renderer = new CanvasRenderer(this.ctx, this.dpr, {
      lowFPS: this.lowPerformance,
      smoothSteps
    });

    this.preview = new PreviewRenderer(this.ctx, {
      lowFPS: this.lowPerformance,
      smoothSteps
    });

    // 监控FPS变化，动态调整渲染质量
    this.monitor.onFpsChange((currentFps) => {
      if (currentFps < 28 && !this.lowPerformance) {
        this.lowPerformance = true;
        this.logger?.info("自动切换到低帧率模式", { fps: currentFps });

        // 动态更新渲染器设置
        this.renderer.lowFPS = true;
        this.preview.lowFPS = true;
        this.preview.smoothSteps = 2;
        this.renderer.smoothSteps = 2;
      } else if (currentFps > 45 && this.lowPerformance) {
        // 如果性能恢复，切回高质量模式
        this.lowPerformance = false;
        this.logger?.info("恢复正常渲染模式", { fps: currentFps });

        // 动态更新渲染器设置
        this.renderer.lowFPS = false;
        this.preview.lowFPS = false;
        this.preview.smoothSteps = 4;
        this.renderer.smoothSteps = 4;
      }
    });

    this.stylusProfile = "default";
    this.setStylusProfile = (name) => {
      this.stylusProfile = name;
      this.stylusAdapter?.useProfile?.(name);
    };

    // 🛠 Debug 日志输出 pointer event
    this._debugEvent = (e) => {
      console.log("PointerEvent:", {
        type: e.type,
        pointerType: e.pointerType,
        pressure: e.pressure,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        x: e.clientX,
        y: e.clientY
      });
    };

    const originalDown = this._onPointerDown?.bind(this);
    this._onPointerDown = (e) => {
      this._debugEvent(e);
      if (this.inputMode === "pen" && e.pointerType !== "pen") return
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      e._patchedPressure = pressure;
      originalDown?.(e);
    };

    // 不需要再次绑定绘图事件，因为构造函数中已经绑定了
    // this._bindEvents()

    // 只在这里绑定UI事件，避免重复绑定
    bindUIEvents({ drawingBoard: this });
    this.logger?.info?.("初始化完成");
  }
}

// 自动挂载（示例）
window.drawingBoard = new DrawingBoard("drawing-board");

export { CanvasRenderer, DrawingBoard, PathSmoother, PreviewRenderer, Stroke, ToolManager, getDevicePixelRatio, measureDevicePerformance };

// SmoothStrategy.js
// 平滑策略与贝塞尔控制点工具函数

import { catmullRom, lerp } from "../utils/math.js"
import { StrokeUtils } from "./StrokeUtils.js"

export class SmoothStrategy {
  constructor({ enabled = true, steps = 4 }) {
    this.enabled = enabled
    this.steps = steps
  }

  apply(points, pressures) {
    if (!this.enabled || points.length < 4) {
      return { points, pressures }
    }

    const smoothed = []
    const smoothedPressures = []

    for (let i = 1; i < points.length - 2; i++) {
      const [p0, p1, p2, p3] = [
        points[i - 1],
        points[i],
        points[i + 1],
        points[i + 2]
      ]
      const interp = catmullRom(p0, p1, p2, p3, this.steps)
      for (let j = 0; j < interp.length; j++) {
        const t = j / interp.length
        smoothed.push(interp[j])
        smoothedPressures.push(lerp(pressures[i], pressures[i + 1], t))
      }
    }

    // ⬇ 加一步采样重构，避免插值锯齿
    const sampled = StrokeUtils.sampleKeyPoints(smoothed, {
      angleThreshold: 0.02,
      distanceThreshold: 2,
      maxSkipPoints: 0
    })
    const resampledPressures = StrokeUtils.resamplePressures(
      smoothedPressures,
      smoothed,
      sampled
    )

    return { points: sampled, pressures: resampledPressures }
  }
}

export function getQuadraticControlPoints(p0, p2) {
  return {
    cx: (p0.x + p2.x) / 2,
    cy: (p0.y + p2.y) / 2
  }
}

export function getMomentumControlPoint(
  p0,
  p1,
  p2,
  { momentumFactor = 0.4 } = {}
) {
  const v1x = p1.x - p0.x,
    v1y = p1.y - p0.y
  const v2x = p2.x - p1.x,
    v2y = p2.y - p1.y
  const len1 = Math.hypot(v1x, v1y) || 0.001
  const len2 = Math.hypot(v2x, v2y) || 0.001
  const dot = (v1x * v2x + v1y * v2y) / (len1 * len2)

  const curvature = Math.max(0, 1 - dot)
  const adaptiveMomentum = momentumFactor * (1 + curvature)
  const blend = normalizeVector({
    x: v1x * (1 - (1 + dot) / 1.5) + v2x * ((1 + dot) / 1.5),
    y: v1y * (1 - (1 + dot) / 1.5) + v2y * ((1 + dot) / 1.5)
  })
  const controlLen = ((len1 + len2) / 2) * adaptiveMomentum

  return {
    cx: p1.x + blend.x * controlLen,
    cy: p1.y + blend.y * controlLen
  }
}

export function getCubicMomentumControlPoints(
  p0,
  p1,
  p2,
  p3,
  { controlFactor = 0.35, speedThreshold = 25 } = {}
) {
  const v1 = diff(p0, p1),
    v2 = diff(p1, p2),
    v3 = diff(p2, p3)
  const len1 = length(v1),
    len2 = length(v2),
    len3 = length(v3)
  const u1 = normalize(v1),
    u2 = normalize(v2),
    u3 = normalize(v3)
  const dp1 = dot(u1, u2),
    dp2 = dot(u2, u3)
  const curvature1 = Math.max(0, 1 - dp1),
    curvature2 = Math.max(0, 1 - dp2)
  const speed = (len1 + len2 + len3) / 3
  const speedFactor = Math.min(1, speed / speedThreshold)

  const ctrl1Len =
    len2 * controlFactor * (1 + curvature1 * 0.75 + speedFactor * 0.5)
  const ctrl2Len =
    len2 * controlFactor * (1 + curvature2 * 0.75 + speedFactor * 0.5)

  const blend1 = normalize(mix(u1, u2, (1 + dp1) / 1.5, 0.3))
  const blend2 = normalize(mix(u2, u3, (1 + dp2) / 1.5, 0.7))

  return {
    cp1x: p1.x + blend1.x * ctrl1Len,
    cp1y: p1.y + blend1.y * ctrl1Len,
    cp2x: p2.x - blend2.x * ctrl2Len,
    cp2y: p2.y - blend2.y * ctrl2Len
  }
}

export function getFinalSegmentControlPoints(
  prev,
  curr,
  next,
  {
    momentumFactor = 0.4,
    speedThreshold = 30,
    endFactor = 0.15,
    isLastSegment = false
  } = {}
) {
  const v1 = diff(prev, curr)
  const v2 = diff(curr, next)
  const len1 = length(v1),
    len2 = length(v2)
  const u1 = normalize(v1),
    u2 = normalize(v2)
  const dotProd = dot(u1, u2)
  const curvature = Math.max(0, 1 - dotProd)
  const speedFactor = Math.min(1, len2 / speedThreshold)

  let cp1Momentum = momentumFactor * (1 + curvature + speedFactor * 0.5)
  if (isLastSegment) {
    cp1Momentum *= Math.max(0.2, Math.min(1, len2 / 10))
    if (dotProd > 0.7) cp1Momentum *= 0.7
  }

  const blend = normalize(mix(u1, u2, (1 + dotProd) / 1.5, 0.5))
  const cp1Len = len2 * cp1Momentum

  const cp1x = curr.x + blend.x * cp1Len
  const cp1y = curr.y + blend.y * cp1Len

  if (isLastSegment) endFactor *= 0.7
  const cp2Factor = endFactor * (1 - curvature * 0.5)

  return {
    cp1x,
    cp1y,
    cp2x: next.x - v2.x * cp2Factor,
    cp2y: next.y - v2.y * cp2Factor
  }
}

function diff(a, b) {
  return { x: b.x - a.x, y: b.y - a.y }
}
function length(v) {
  return Math.hypot(v.x, v.y) || 0.001
}
function dot(a, b) {
  return a.x * b.x + a.y * b.y
}
function normalize(v) {
  const len = length(v)
  return { x: v.x / len, y: v.y / len }
}
function mix(v1, v2, blendFactor, w2 = 0.3) {
  const w1 = 1 - w2
  return {
    x: v1.x * (1 - blendFactor * w1) + v2.x * blendFactor * w2,
    y: v1.y * (1 - blendFactor * w1) + v2.y * blendFactor * w2
  }
}
function normalizeVector(v) {
  const len = Math.hypot(v.x, v.y) || 0.001
  return { x: v.x / len, y: v.y / len }
}

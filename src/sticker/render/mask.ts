import type { BinaryMask, OpaqueBounds } from './types'

/** 距离变换中的无穷远哨兵值 */
const DISTANCE_INF: number = 1e15

// ---------------------------------------------------------------------------
// 性能优化说明（双端像素级一致）:
//   ① DT 缓存复用: 导出 computeSquaredDistanceTransform，允许调用方缓存 & 复用。
//   ② sqrt 边界裁剪: createAntialiasedAlpha 中远离边界的像素跳过 sqrt。
//   ③ 内存池复用: DT 内部复用 column/vertices/boundaries 缓冲区，消除 temporary。
//   ④ Scanline flood-fill: 替换逐像素栈式 flood-fill，栈深 O(H)。
//   ⑤ Float64→Float32: 所有距离变换使用 Float32Array，内存减半、缓存更友好。
// ---------------------------------------------------------------------------

export function thresholdAlphaMask(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
): BinaryMask {
  const data = new Uint8ClampedArray(width * height)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = alpha[index] >= threshold ? 255 : 0
  }

  return { width, height, data }
}

/**
 * 圆形膨胀（Minkowski sum）。
 * @param precomputedDT 可选预计算的前景 → 外部 平方距离场，避免重复计算。
 */
export function dilateMaskRound(
  mask: BinaryMask,
  radius: number,
  precomputedDT?: Float32Array,
): BinaryMask {
  if (radius <= 0) {
    return cloneMask(mask)
  }

  const squaredDistances = precomputedDT ?? computeSquaredDistanceTransform(mask)
  const data = new Uint8ClampedArray(mask.data.length)
  const radiusSquared = radius * radius

  for (let index = 0; index < data.length; index += 1) {
    data[index] = squaredDistances[index] <= radiusSquared ? 255 : 0
  }

  return { width: mask.width, height: mask.height, data }
}

/**
 * 圆形腐蚀。
 * @param precomputedInvertedDT 可选预计算的反转 mask 的平方距离场。
 */
export function erodeMaskRound(
  mask: BinaryMask,
  radius: number,
  precomputedInvertedDT?: Float32Array,
): BinaryMask {
  if (radius <= 0) {
    return cloneMask(mask)
  }

  // 腐蚀 = 保留前景中离边界 > radius 的像素。
  // 反转 mask 的 DT 在前景像素处的值 = 该像素到最近背景边界的平方距离。
  const inverted = invertMask(mask)
  const squaredDistances =
    precomputedInvertedDT ?? computeSquaredDistanceTransform(inverted)
  const data = new Uint8ClampedArray(mask.data.length)
  const radiusSquared = radius * radius

  for (let index = 0; index < data.length; index += 1) {
    data[index] =
      mask.data[index] > 0 && squaredDistances[index] > radiusSquared ? 255 : 0
  }

  return { width: mask.width, height: mask.height, data }
}

export function subtractMask(
  source: BinaryMask,
  subtractor: BinaryMask,
): BinaryMask {
  const data = new Uint8ClampedArray(source.data.length)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = source.data[index] > 0 && subtractor.data[index] === 0 ? 255 : 0
  }

  return { width: source.width, height: source.height, data }
}

export function findOpaqueBounds(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
): OpaqueBounds | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] === 0) {
        continue
      }

      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right === -1) {
    return null
  }

  return { left, top, right, bottom }
}

// ---------------------------------------------------------------------------
// ④ Scanline flood-fill
//    逐段处理替代逐像素入栈，push/pop 次数从 O(W×H) 降至 O(边界周长)，
//    栈深度最大为 O(H)。
// ---------------------------------------------------------------------------

export function fillEnclosedRegions(mask: BinaryMask): BinaryMask {
  const { width, height, data } = mask
  const exterior = new Uint8Array(data.length)

  // 段栈条目: [y, xLeft, xRight, dy]
  const segStack: number[] = []

  const pushSeg = (y: number, xLeft: number, xRight: number, dy: number) => {
    const ny = y + dy
    if (ny >= 0 && ny < height) {
      segStack.push(ny, xLeft, xRight, dy)
    }
  }

  // 扫描并标记一段连续背景像素，返回段的右端 x（不含）
  const fillSpan = (y: number, xStart: number): number => {
    const rowBase = y * width
    let x = xStart
    while (x < width && data[rowBase + x] === 0) {
      exterior[rowBase + x] = 1
      x += 1
    }
    return x
  }

  // 从四条边界种子
  // 顶边 & 底边
  for (const edgeY of [0, height - 1]) {
    if (edgeY < 0 || edgeY >= height) continue
    let x = 0
    const rowBase = edgeY * width
    while (x < width) {
      if (data[rowBase + x] > 0 || exterior[rowBase + x] !== 0) {
        x += 1
        continue
      }
      const xLeft = x
      x = fillSpan(edgeY, x)
      const xRight = x - 1
      // 向内扩展
      if (edgeY === 0) pushSeg(edgeY, xLeft, xRight, 1)
      if (edgeY === height - 1) pushSeg(edgeY, xLeft, xRight, -1)
    }
  }
  // 左边 & 右边
  for (let y = 1; y < height - 1; y += 1) {
    const rowBase = y * width
    // 左侧
    if (data[rowBase] === 0 && exterior[rowBase] === 0) {
      const xRight = fillSpan(y, 0) - 1
      pushSeg(y, 0, xRight, -1)
      pushSeg(y, 0, xRight, 1)
    }
    // 右侧
    const rightIdx = rowBase + width - 1
    if (data[rightIdx] === 0 && exterior[rightIdx] === 0) {
      // 向左找段起点
      let x = width - 1
      while (x >= 0 && data[rowBase + x] === 0 && exterior[rowBase + x] === 0) {
        exterior[rowBase + x] = 1
        x -= 1
      }
      const xLeft = x + 1
      pushSeg(y, xLeft, width - 1, -1)
      pushSeg(y, xLeft, width - 1, 1)
    }
  }

  // 处理段栈
  while (segStack.length > 0) {
    const dy = segStack.pop()!
    const parentRight = segStack.pop()!
    const parentLeft = segStack.pop()!
    const y = segStack.pop()!
    const rowBase = y * width

    let x = parentLeft
    while (x <= parentRight) {
      // 跳过前景或已标记像素
      if (data[rowBase + x] > 0 || exterior[rowBase + x] !== 0) {
        x += 1
        continue
      }
      // 向左扩展
      let spanLeft = x
      while (spanLeft > 0 && data[rowBase + spanLeft - 1] === 0 && exterior[rowBase + spanLeft - 1] === 0) {
        spanLeft -= 1
        exterior[rowBase + spanLeft] = 1
      }
      // 向右填充
      while (x < width && data[rowBase + x] === 0 && exterior[rowBase + x] === 0) {
        exterior[rowBase + x] = 1
        x += 1
      }
      const spanRight = x - 1

      // 向同方向和反方向扩展
      pushSeg(y, spanLeft, spanRight, dy)
      pushSeg(y, spanLeft, spanRight, -dy)
      x += 1
    }
  }

  const result = new Uint8ClampedArray(data.length)
  for (let index = 0; index < data.length; index += 1) {
    result[index] = data[index] > 0 || exterior[index] === 0 ? 255 : 0
  }

  return { width, height, data: result }
}

function cloneMask(mask: BinaryMask): BinaryMask {
  return {
    width: mask.width,
    height: mask.height,
    data: new Uint8ClampedArray(mask.data),
  }
}

// ---------------------------------------------------------------------------
// ② sqrt 边界裁剪
//    对远离 feather 边界的像素直接赋 0/255，跳过 Math.sqrt。
//    典型场景下 >95% 像素走快速路径。
// ---------------------------------------------------------------------------

/**
 * 从二值 mask 生成反走样 alpha 通道（SDF feathering）。
 * @param precomputedOutsideDT 预计算的 mask→外部 平方距离场。
 * @param precomputedInsideDT 预计算的 invertMask→外部 平方距离场。
 */
export function createAntialiasedAlpha(
  mask: BinaryMask,
  featherRadius: number,
  precomputedOutsideDT?: Float32Array,
  precomputedInsideDT?: Float32Array,
): Uint8ClampedArray {
  const outsideDistances =
    precomputedOutsideDT ?? computeSquaredDistanceTransform(mask)
  const insideDistances =
    precomputedInsideDT ?? computeSquaredDistanceTransform(invertMask(mask))
  const alpha = new Uint8ClampedArray(mask.data.length)
  const feather = Math.max(0.01, featherRadius)
  const featherSquared = feather * feather

  for (let index = 0; index < alpha.length; index += 1) {
    const outsideSq = outsideDistances[index]
    const insideSq = insideDistances[index]

    // 快速路径：完全在 mask 外部、远离边界
    if (outsideSq > featherSquared && insideSq === 0) {
      // alpha[index] = 0 (default)
      continue
    }
    // 快速路径：完全在 mask 内部、远离边界
    if (insideSq > featherSquared && outsideSq === 0) {
      alpha[index] = 255
      continue
    }

    const signedDistance = Math.sqrt(outsideSq) - Math.sqrt(insideSq)
    const normalized = clampUnitInterval(0.5 - signedDistance / (2 * feather))
    alpha[index] = Math.round(normalized * 255)
  }

  return alpha
}

export function invertMask(mask: BinaryMask): BinaryMask {
  const data = new Uint8ClampedArray(mask.data.length)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = mask.data[index] === 0 ? 255 : 0
  }

  return { width: mask.width, height: mask.height, data }
}

// ---------------------------------------------------------------------------
// ①⑤ 距离变换 — 导出供外部缓存复用，使用 Float32Array 减半内存。
//    内部复用 column/vertices/boundaries 缓冲区（③ 内存池）。
// ---------------------------------------------------------------------------

export function computeSquaredDistanceTransform(mask: BinaryMask): Float32Array {
  const { width, height } = mask
  const size = width * height
  const distances = new Float32Array(size)

  // ③ 复用缓冲区：column、vertices、boundaries 只分配一次
  const maxDim = Math.max(width, height)
  const column = new Float32Array(maxDim)
  const columnDistances = new Float32Array(maxDim)
  const vertices = new Int32Array(maxDim)
  const boundaries = new Float32Array(maxDim + 1)

  // Pass 1: 纵向（逐列）—— 直接写入 distances，省掉 temporary 数组
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      column[y] = mask.data[y * width + x] > 0 ? 0 : DISTANCE_INF
    }

    transformDistanceAxis(column, height, columnDistances, vertices, boundaries)

    for (let y = 0; y < height; y += 1) {
      distances[y * width + x] = columnDistances[y]
    }
  }

  // Pass 2: 横向（逐行）
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width
    for (let x = 0; x < width; x += 1) {
      column[x] = distances[rowOffset + x]
    }

    transformDistanceAxis(column, width, columnDistances, vertices, boundaries)

    for (let x = 0; x < width; x += 1) {
      distances[rowOffset + x] = columnDistances[x]
    }
  }

  return distances
}

function transformDistanceAxis(
  source: Float32Array,
  length: number,
  target: Float32Array,
  vertices: Int32Array,
  boundaries: Float32Array,
): void {
  let hullSize = 0

  vertices[0] = 0
  boundaries[0] = -DISTANCE_INF
  boundaries[1] = DISTANCE_INF

  for (let position = 1; position < length; position += 1) {
    let intersection = calculateSeparation(
      source,
      position,
      vertices[hullSize],
    )

    while (intersection <= boundaries[hullSize]) {
      hullSize -= 1
      intersection = calculateSeparation(
        source,
        position,
        vertices[hullSize],
      )
    }

    hullSize += 1
    vertices[hullSize] = position
    boundaries[hullSize] = intersection
    boundaries[hullSize + 1] = DISTANCE_INF
  }

  hullSize = 0

  for (let position = 0; position < length; position += 1) {
    while (boundaries[hullSize + 1] < position) {
      hullSize += 1
    }

    const distance = position - vertices[hullSize]
    target[position] = distance * distance + source[vertices[hullSize]]
  }
}

function calculateSeparation(
  source: Float32Array,
  current: number,
  previous: number,
): number {
  return (
    (source[current] + current * current - (source[previous] + previous * previous)) /
    (2 * current - 2 * previous)
  )
}

function clampUnitInterval(value: number): number {
  return Math.min(1, Math.max(0, value))
}

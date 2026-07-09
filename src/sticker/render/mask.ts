import type { BinaryMask, OpaqueBounds } from './types'

const DISTANCE_INF = 1e15

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

export function dilateMaskRound(mask: BinaryMask, radius: number): BinaryMask {
  if (radius <= 0) {
    return cloneMask(mask)
  }

  const squaredDistances = computeSquaredDistanceTransform(mask)
  const data = new Uint8ClampedArray(mask.data.length)
  const radiusSquared = radius * radius

  for (let index = 0; index < data.length; index += 1) {
    data[index] = squaredDistances[index] <= radiusSquared ? 255 : 0
  }

  return { width: mask.width, height: mask.height, data }
}

export function erodeMaskRound(mask: BinaryMask, radius: number): BinaryMask {
  if (radius <= 0) {
    return cloneMask(mask)
  }

  return invertMask(dilateMaskRound(invertMask(mask), radius))
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

export function fillEnclosedRegions(mask: BinaryMask): BinaryMask {
  const { width, height, data } = mask
  const exterior = new Uint8Array(data.length)
  const stack: number[] = []

  const pushIfBackground = (index: number) => {
    if (data[index] === 0 && exterior[index] === 0) {
      exterior[index] = 1
      stack.push(index)
    }
  }

  for (let x = 0; x < width; x += 1) {
    pushIfBackground(x)
    pushIfBackground((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBackground(y * width)
    pushIfBackground(y * width + width - 1)
  }

  while (stack.length > 0) {
    const index = stack.pop() as number
    const x = index % width
    const y = (index - x) / width

    if (x > 0) pushIfBackground(index - 1)
    if (x < width - 1) pushIfBackground(index + 1)
    if (y > 0) pushIfBackground(index - width)
    if (y < height - 1) pushIfBackground(index + width)
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

export function createAntialiasedAlpha(
  mask: BinaryMask,
  featherRadius: number,
): Uint8ClampedArray {
  const outsideDistances = computeSquaredDistanceTransform(mask)
  const insideDistances = computeSquaredDistanceTransform(invertMask(mask))
  const alpha = new Uint8ClampedArray(mask.data.length)
  const feather = Math.max(0.01, featherRadius)

  for (let index = 0; index < alpha.length; index += 1) {
    const signedDistance =
      Math.sqrt(outsideDistances[index]) - Math.sqrt(insideDistances[index])
    const normalized = clampUnitInterval(0.5 - signedDistance / (2 * feather))
    alpha[index] = Math.round(normalized * 255)
  }

  return alpha
}

function invertMask(mask: BinaryMask): BinaryMask {
  const data = new Uint8ClampedArray(mask.data.length)

  for (let index = 0; index < data.length; index += 1) {
    data[index] = mask.data[index] === 0 ? 255 : 0
  }

  return { width: mask.width, height: mask.height, data }
}

function computeSquaredDistanceTransform(mask: BinaryMask): Float64Array {
  const { width, height } = mask
  const temporary = new Float64Array(width * height)
  const distances = new Float64Array(width * height)
  const column = new Float64Array(Math.max(width, height))
  const columnDistances = new Float64Array(Math.max(width, height))

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      column[y] = mask.data[y * width + x] > 0 ? 0 : DISTANCE_INF
    }

    transformDistanceAxis(column, height, columnDistances)

    for (let y = 0; y < height; y += 1) {
      temporary[y * width + x] = columnDistances[y]
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      column[x] = temporary[y * width + x]
    }

    transformDistanceAxis(column, width, columnDistances)

    for (let x = 0; x < width; x += 1) {
      distances[y * width + x] = columnDistances[x]
    }
  }

  return distances
}

function transformDistanceAxis(
  source: Float64Array,
  length: number,
  target: Float64Array,
): void {
  const vertices = new Int32Array(length)
  const boundaries = new Float64Array(length + 1)
  let hullSize = 0

  vertices[0] = 0
  boundaries[0] = Number.NEGATIVE_INFINITY
  boundaries[1] = Number.POSITIVE_INFINITY

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
    boundaries[hullSize + 1] = Number.POSITIVE_INFINITY
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
  source: Float64Array,
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

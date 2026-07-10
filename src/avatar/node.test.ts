import { describe, expect, it } from 'vitest'
import {
  renderAvatarToBuffer,
} from './node'

function pngSize(buffer: Buffer | Uint8Array) {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  )
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  }
}

describe('node avatar renderer', () => {
  it('renders a fixed-size square PNG', async () => {
    const buffer = await renderAvatarToBuffer({
      text: '前端群',
      style: 'sunset',
      size: 256,
      rotation: -8,
    }, {
      antialiasScale: 1,
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(pngSize(buffer)).toEqual({ width: 256, height: 256 })
  })
})

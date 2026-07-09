import { describe, expect, it } from 'vitest'
import {
  StickerGenerator,
  createNapiCanvasRuntime,
  renderStickerToBuffer,
  renderStickerToPngBytes,
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

describe('node sticker renderer', () => {
  it('renders PNG bytes without browser APIs', async () => {
    const bytes = await renderStickerToPngBytes({
      text: '高峰不常有',
      icon: '',
      envelope: { colors: ['#1688ff'], gradientAngle: 0 },
    })

    expect(bytes.byteLength).toBeGreaterThan(1024)
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ])
  })

  it('returns a Buffer for Node bots', async () => {
    const buffer = await renderStickerToBuffer('高峰不常有', { loadIcon: false })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  })

  it('keeps output dimensions close when 3x antialiasing is enabled', async () => {
    const base = await renderStickerToBuffer('高峰不常有', {
      loadIcon: false,
      antialiasScale: 1,
    })
    const antialiased = await renderStickerToBuffer('高峰不常有', {
      loadIcon: false,
      antialiasScale: 3,
    })

    const baseSize = pngSize(base)
    const antialiasedSize = pngSize(antialiased)
    expect(Math.abs(antialiasedSize.width - baseSize.width)).toBeLessThan(12)
    expect(Math.abs(antialiasedSize.height - baseSize.height)).toBeLessThan(6)
    expect(antialiased.byteLength).toBeGreaterThan(1024)
  })

  it('supports an explicit StickerGenerator runtime', async () => {
    const generator = new StickerGenerator(await createNapiCanvasRuntime())
    const buffer = await generator.renderBuffer({
      text: '高峰不常有',
      icon: '',
      envelope: {
        colors: ['#1688ff', '#44b305'],
        gradientAngle: 45,
      },
    }, {
      outputScale: 2,
      antialiasScale: 1,
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(pngSize(buffer).width).toBeGreaterThan(800)
  })
})

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/sticker/index.ts',
    core: 'src/sticker/core.ts',
    node: 'src/sticker/node.ts',
  },
  outDir: 'lib/sticker',
  format: 'esm',
  dts: true,
  platform: 'node',
  target: 'es2023',
  tsconfig: 'tsconfig.node.json',
  deps: {
    neverBundle: ['@napi-rs/canvas'],
  },
  exports: {
    packageJson: false,
    legacy: true,
  },
})

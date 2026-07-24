import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/sticker/index.ts',
    core: 'src/sticker/core.ts',
    node: 'src/sticker/node.ts',
    avatar: 'src/avatar/index.ts',
    'avatar/core': 'src/avatar/core.ts',
    'avatar/node': 'src/avatar/node.ts',
  },
  outDir: 'lib/sticker',
  format: 'esm',
  dts: true,
  platform: 'node',
  target: 'es2023',
  tsconfig: 'tsconfig.package.json',
  deps: {
    neverBundle: ['@napi-rs/canvas'],
  },
  exports: {
    packageJson: false,
    legacy: true,
  },
})

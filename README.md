# 高峰生成器

浏览器里的中文「攀登体」表情包生成器。输入文字，即时生成带彩色渐变、描边与错位攀登效果的贴纸，一键复制图片或分享链接。

**在线体验** · [GitHub Pages](https://zhousiru.github.io/scale-new-heights-generator)

也可以作为 npm 包在 Node 无头环境里使用，直接生成 PNG `Buffer`，适合飞书机器人、定时任务、CLI 等没有浏览器 UI 的场景。

## 特性

- **两种风味**
  - **勇攀高峰**（抖音美好体）：白色字形置于彩色渐变包体内，配深色边缘轮廓。
  - **字节范**（优设标题黑）：彩色渐变字形，带同色系深色外轮廓。
- **错位攀登**：词与词以高低错落的基线「攀登」，也可切换为对齐平铺。
- **文本 / 图标倾斜**：可分别开关字面固有的旋转、斜切；圆形/徽章类图标自动保持直立。
- **前缀图标**：接入 [Iconify](https://iconify.design/)，输入 `mdi:rocket`、`tabler:planet` 等 id 即可作为前缀字形。
- **智能配色**
  - 支持 1~3 个渐变停靠点，附方向旋钮。
  - 单色自动在 OKLCH 空间线性补出同色系暗端；浅色少降亮度，鲜艳色适度降 chroma，避免暗端过深或荧光。
  - 随机配色从均衡色相桶取样，避开与当前色过近的区间，不会老是随机到粉紫。
- **27 个内置预设**，按「字节范 / 勇攀高峰 / 务实浪漫系列 / 地震级创意」分组。
- **高级设置**：抗锯齿倍率、描边厚度、行高、上下/左右留白等。
- **可分享 URL**：所有控件状态同步到 query（仅序列化非默认值），链接即状态。
- **导出**：复制图片到剪贴板、导出 PNG（iframe 内改为新标签页打开）、复制生成链接。
- 跟随系统的深色模式。

## 技术栈

- [React 19](https://react.dev/)
- [Vite 8](https://vite.dev/)（Rolldown）+ TypeScript（strict）
- [TanStack Router](https://tanstack.com/router) —— URL 状态同步
- Web Worker + `OffscreenCanvas` —— 离主线程渲染
- [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) —— 可选的默认 Node 无头 PNG runtime
- [colord](https://github.com/omgovich/colord) —— 颜色处理
- [@iconify/react](https://iconify.design/) —— 图标
- [Vitest](https://vitest.dev/) + oxlint

## 快速开始

需要 Node 22+ 与 pnpm。

```bash
pnpm install
pnpm dev        # 启动开发服务器
```

### 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建浏览器应用与 npm 包产物 |
| `pnpm build:app` | 浏览器应用生产构建 |
| `pnpm build:package` | 用 `rimraf` 清理旧产物，再由 `tsdown` 构建 npm 包入口与类型声明 |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm test` | 运行 Vitest 单测 |
| `pnpm lint` | 运行 oxlint |

## Node 无头用法

面向机器人服务端使用 `scale-new-heights-generator/node` 子入口。它不依赖 React、DOM、Web Worker 或 Chromium；默认会在真正渲染时动态加载可选依赖 `@napi-rs/canvas`。如果部署环境不想安装 native 依赖，可以只用根入口 / `core` 入口，或通过 `new StickerGenerator(runtime)` 注入自己的 canvas runtime。

```ts
import { renderStickerToBuffer } from 'scale-new-heights-generator/node'

const png = await renderStickerToBuffer({
  text: '高峰不常有',
  envelope: {
    colors: ['#1688ff', '#44b305'],
    gradientAngle: 45,
  },
  icon: '',
}, {
  outputScale: 2,
})

// 飞书机器人可以直接把 png 传给现有图片上传逻辑：
// const imageKey = await uploadImage(bot, png, 'sticker.png')
// await sendImageToChat(bot, chatId, imageKey)
```

Web 高级设置与 Node 渲染都支持 1-5x 内部超采样抗锯齿，默认 1.5x，用来压掉斜线和斜切边缘的阶梯锯齿。极限性能或排障场景可临时关闭：

```ts
await renderStickerToBuffer('高峰不常有', {
  antialiasScale: 1,
})
```

如果运行环境禁止出网，可关闭 Iconify 图标拉取：

```ts
const png = await renderStickerToBuffer('高峰不常有', { loadIcon: false })
```

自定义 runtime 时，不需要安装 `@napi-rs/canvas`。runtime 至少需要提供 `createCanvas` 和 `toPngBytes`；如果要自动注册字体或加载前缀图标，再补 `registerFont` / `hasFont` / `loadImage`：

```ts
import { StickerGenerator, type StickerGeneratorRuntime } from 'scale-new-heights-generator/node'

const runtime: StickerGeneratorRuntime = {
  createCanvas: (width, height) => myCanvasFactory(width, height),
  toPngBytes: async (canvas) => await encodePng(canvas),
}

const generator = new StickerGenerator(runtime)
const png = await generator.renderBuffer('高峰不常有', { loadIcon: false })
```

包内会默认注册 `public/DouyinSansBold.woff2` 与 `public/YouSheBiaoTiHei.ttf`。如果部署系统把字体复制到了其他目录，可以显式传入：

```ts
await renderStickerToBuffer('高峰不常有', {
  fontFiles: {
    snh: '/opt/fonts/DouyinSansBold.woff2',
    bs: '/opt/fonts/YouSheBiaoTiHei.ttf',
  },
})
```

根入口只导出配置、预设、URL 编解码和配色工具等纯逻辑：

```ts
import { DEFAULT_STICKER_CONTROLS, STICKER_PRESET_LIST } from 'scale-new-heights-generator'
```

`core` 子入口导出不绑定具体 runtime 的渲染核心，适合接入非 `@napi-rs/canvas` 的服务端画布实现：

```ts
import { renderSticker, setCanvasRuntime } from 'scale-new-heights-generator/core'
```

## 工作原理

渲染是这个项目的核心，分工如下：

- **渲染管线**（[`sticker.ts`](src/sticker/render/sticker.ts)）：在 `OffscreenCanvas` 上完成排版、字形整形、蒙版膨胀（描边）、渐变填充与裁剪。核心能力拆在 `layout`、`mask`、`gradient`、`glyphs` 等 render 模块中；为避免阻塞 UI，主流程运行在 [Web Worker](src/sticker/worker/renderSticker.worker.ts) 内。
- **无头渲染**（[`node.ts`](src/sticker/node.ts)）：默认动态加载可选的 `@napi-rs/canvas` runtime，也支持 `StickerGenerator(runtime)` 注入自定义 runtime，输出 PNG bytes / `Buffer`，给 Node 机器人直接上传。
- **渐变沿实际形状铺设**：`createLinearGradient` 的坐标是画布全局坐标，不随形状走。引擎会扫描文字蒙版像素在渐变方向上的投影范围来定义渐变线，让端点色真正落在可见像素两端，而非被画布外区域「吃掉」。
- **Emoji 原生彩色叠加**：Emoji 被排除在描边蒙版之外，最后以系统原生彩色单独绘制，避免被着色成纯色、也避免其抗锯齿边缘产生描边杂点。
- **图标栅格化在主线程**（[`iconLoader.ts`](src/sticker/utils/iconLoader.ts)）：Chromium 只能在主线程栅格化 SVG，因此图标先在主线程拉取并绘制为 `ImageBitmap`，再转移进 worker。
- **配色算法**（[`color.ts`](src/sticker/utils/color.ts)）：单色补深、随机取色、gamut 收敛等，均有 [单测](src/sticker/utils/color.test.ts) 覆盖。

### URL 状态

控件被编码为紧凑的短键 query（如 `?t=勇攀高峰&fl=bs&gc=08e-9cf`），只写入与默认值不同的项。编解码逻辑见 [`searchParams.ts`](src/sticker/config/searchParams.ts)。在 iframe 内地址栏由父页控制，路由改用内存 history，避免与宿主争抢 URL。

## 项目结构

```
src/
├── App.tsx                    # 页面壳：组合控制面板与预览面板
├── router/router.ts           # TanStack Router 配置
└── sticker/
    ├── index.ts               # npm 根入口：预设、配置、URL 与配色纯逻辑
    ├── core.ts                # npm core 入口：可注入 runtime 的渲染核心
    ├── node.ts                # npm node 入口：默认 Node runtime 与 PNG Buffer API
    ├── components/            # 控制面板、预览面板、角度旋钮
    ├── hooks/                 # 状态、URL 同步、预览与导出副作用
    ├── config/                # 控件模型、预设、URL query、worker 协议
    ├── render/                # 渲染管线、布局、蒙版、渐变、canvas runtime
    ├── utils/                 # 配色算法、Iconify 栅格化等通用工具
    └── worker/                # worker 入口与通信封装
```

## 使用提示

发送时复制图片粘贴到聊天框，发出后右键「添加为表情」，尺寸和形态才正常。

## 部署

推送到 `main` 会由 [GitHub Actions](.github/workflows/deploy.yml) 自动构建并发布到 GitHub Pages。构建时通过 `VITE_BASE` 注入仓库名作为 base 路径。

## 字体

- 勇攀高峰：抖音美好体（`DouyinSansBold.woff2`）
- 字节范：优设标题黑（`YouSheBiaoTiHei.ttf`）

两款均为免费商用字体。

## 免责声明

内置预设中的文案仅供效果演示，不代表任何立场，也与相关企业无官方关联。请勿用于可能引起误解或侵权的场合。

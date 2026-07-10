# 高峰生成器

浏览器里的中文「勇攀高峰」表情包与飞书头像生成器。输入文字，即时生成带彩色渐变、描边与错位攀登效果的贴纸，或生成指定尺寸的飞书群头像。

**在线体验** · [GitHub Pages](https://zhousiru.github.io/scale-new-heights-generator)

也可以作为 npm 包在 Node 无头环境里使用，直接生成 PNG `Buffer`，适合飞书机器人、定时任务、CLI 等没有浏览器 UI 的场景。

## v3 更新

- 新增 `/avatar` 飞书头像生成器：固定方图、贴边圆形、彩底白字 / 白底彩环同色字、手选样式、文字旋转与自适应多行排版。
- 贴纸和头像都支持 `HDR 高亮`：开启后导出 Ultra HDR JPEG gain map；关闭时仍导出普通 PNG。
- UI 改为 Radix/shadcn 风格的本地组件，控制面板、预览、footer、worker 通信与渲染 runtime 做了共享拆分。
- 状态会保存在 URL 和本地工具入口中，贴纸与头像之间切换不会丢掉刚调好的参数。

## 特性

- **两种风味**
  - **勇攀高峰**（抖音美好体）：白色字形置于彩色渐变包体内，配深色边缘轮廓。
  - **字节范**（优设标题黑）：彩色渐变字形，带同色系深色外轮廓。
- **错位攀登**：词与词以高低错落的基线「攀登」，也可切换为对齐平铺。
- **文本 / 图标倾斜**：可分别开关字面固有的旋转、斜切；圆形/徽章类图标自动保持直立。
- **字体策略**：中文命中特色字体，西文优先走 Inter Latin Bold；SNH 会根据中文占比决定少量英文/数字是否随抖音美好体排版。
- **前缀图标**：接入 [Iconify](https://iconify.design/)，输入 `mdi:rocket`、`tabler:planet` 等 id 即可作为前缀字形；支持单色、多色与 `-duotone` 双色图标。
- **智能配色**
  - 支持 1~3 个渐变停靠点，附方向旋钮；有图标默认 90°，无图标默认 180°。
  - 单色自动补出同色系深色，默认形成「上深下浅」的纵向渐变。
  - 随机配色直接随机色相，并避开与当前色过近的颜色；字节范使用同色系双色基准，再由渲染层派生深轮廓和浅前景。
- **27 个内置预设**，按「字节范 / 勇攀高峰 / 务实浪漫系列 / 地震级创意」分组。
- **高级设置**：抗锯齿倍率、描边厚度、行高、上下/左右留白等。
- **可分享 URL**：所有控件状态同步到 query（仅序列化非默认值），复制链接默认生成 `m=simple` 简易模式，适合 iframe 预览。
- **飞书头像**：`/avatar` 路径生成固定边长方形头像；支持「彩底白字」与「白底彩环同色字」两种模式，群名在圆内自适应多行，渐变样式可手动选择，支持文字旋转。
- **HDR 高亮**：贴纸与头像都支持 Ultra HDR JPEG gain map 输出，强度用 EV stops 表示，`maxContentBoost = 2^EV`；关闭时导出普通 PNG。
- **导出**：复制图片到剪贴板、导出图片（iframe 内改为新标签页打开）、复制生成链接；受限 iframe 会引导右键复制图片。
- 跟随系统的深色模式。

## 技术栈

- [React 19](https://react.dev/)
- [Vite 8](https://vite.dev/)（Rolldown）+ TypeScript（strict）
- [TanStack Router](https://tanstack.com/router) —— URL 状态同步
- [Radix UI](https://www.radix-ui.com/) + 本地 shadcn 风格组件 —— Select、Slider、Collapsible、Button 等基础控件
- Web Worker + `OffscreenCanvas` —— 离主线程渲染
- [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) —— 可选的默认 Node 无头 PNG runtime
- [Inter](https://rsms.me/inter/)（`inter-ui` 拉丁子集）—— 西文字体
- [colord](https://github.com/omgovich/colord) —— 颜色处理
- [hdrify](https://www.npmjs.com/package/hdrify) —— Ultra HDR JPEG gain map 编码
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
| `pnpm build:package` | 由 `tsdown.config.ts` 构建 npm 包入口、类型声明并同步 package exports |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm test` | 运行 Vitest 单测 |
| `pnpm lint` | 按 `.oxlintrc.json` 运行 oxlint |

## Node 无头用法

面向机器人服务端使用 `scale-new-heights-generator/node` 子入口。它不依赖 React、DOM、Web Worker 或 Chromium；默认会在真正渲染时动态加载可选依赖 `@napi-rs/canvas`。如果部署环境不想安装 native 依赖，可以通过 `new StickerGenerator(runtime)` 注入自己的 canvas runtime。

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
    inter: '/opt/fonts/Inter-Bold-subset.woff2',
  },
})
```

Inter Latin Bold 默认从 `inter-ui/web-latin/Inter-Bold-subset.woff2` 解析，注册为独立字体族 `Inter Latin Bold`；缺失时会退回系统 sans-serif。Emoji / Symbol fallback 字体会按运行环境可用性注册：macOS 优先 Apple Color Emoji / Apple Symbols，Windows 走 Segoe UI Emoji / Segoe UI Symbol，Linux 或容器环境可使用包内或显式传入的 Noto 字体。

根入口只导出配置、预设、URL 编解码和配色工具等纯逻辑：

```ts
import { DEFAULT_STICKER_CONTROLS, STICKER_PRESET_LIST } from 'scale-new-heights-generator'
```

`core` 子入口导出不绑定 Node 的渲染核心，适合在 Web 或自定义 Canvas runtime 中复用：

```ts
import { renderSticker, setCanvasRuntime } from 'scale-new-heights-generator/core'
```

飞书头像使用独立入口，不依赖 sticker 的字形/描边管线：

```ts
import { renderAvatarToBuffer } from 'scale-new-heights-generator/avatar/node'

const png = await renderAvatarToBuffer({
  text: '前端群',
  style: 'sunset',
  mode: 'outline',
  size: 512,
  rotation: -8,
})
```

## 工作原理

渲染是这个项目的核心，分工如下：

- **渲染管线**（[`sticker.ts`](src/sticker/render/sticker.ts)）：在 `OffscreenCanvas` 上完成排版、字形整形、蒙版膨胀（描边）、渐变填充与裁剪。核心能力拆在 `layout`、`mask`、`gradient`、`glyphs` 等 render 模块中；为避免阻塞 UI，主流程运行在 [Web Worker](src/sticker/worker/renderSticker.worker.ts) 内。
- **无头渲染**（[`node.ts`](src/sticker/node.ts)）：默认动态加载可选的 `@napi-rs/canvas` runtime，也支持 `StickerGenerator(runtime)` 注入自定义 runtime，输出 PNG bytes / `Buffer`，给 Node 机器人直接上传。
- **渐变沿实际形状铺设**：`createLinearGradient` 的坐标是画布全局坐标，不随形状走。引擎会扫描文字蒙版像素在渐变方向上的投影范围来定义渐变线，让端点色真正落在可见像素两端，而非被画布外区域「吃掉」。
- **字体选择**（[`font.ts`](src/sticker/render/font.ts)）：按 grapheme 决定字体。优设标题黑覆盖中英文数字；抖音美好体在中文占多数时承载少量英文/数字，否则西文交给 Inter；Emoji 与 Symbol 落到系统彩色字体。
- **Emoji 原生彩色 + 描边**：渲染层拆分 `shapeMask` 与 `foregroundMask`。Emoji 参与外轮廓/描边，但最终仍以原生彩色叠加；Apple Color Emoji 角点杂像素会按字符隔离裁剪，避免污染描边。
- **图标栅格化在主线程**（[`iconLoader.ts`](src/sticker/utils/iconLoader.ts)）：Chromium 只能在主线程栅格化 SVG，因此图标先在主线程拉取并绘制为 `ImageBitmap`，再转移进 worker。单色图标作为剪影随文字配色重着色；多色和 duotone 图标保留原生配色并同样参与外轮廓。
- **内存友好导出**：裁剪、缩放、padding 合成一步完成，避免连续创建大尺寸中间画布；paint buffer 与 mask canvas 会复用，降低 Node/Worker 渲染峰值内存。
- **贴纸 HDR 管线**：开启 `HDR 高亮` 后，worker 会把最终贴纸画布转为线性 HDR 浮点图，再用 `hdrify` 写成 Ultra HDR JPEG gain map。普通 PNG 仍保留透明通道；HDR JPEG 按格式限制合成白底。
- **配色算法**（[`color.ts`](src/sticker/utils/color.ts)）：单色补深、随机取色、字节范双色基准等，均有 [单测](src/sticker/utils/color.test.ts) 覆盖。
- **飞书头像管线**（[`avatar.ts`](src/avatar/render/avatar.ts)）：独立执行贴边圆形、手选样式、多行群名自适应与文字旋转。`fill` 为全幅渐变背景白字，`outline` 为全幅白底彩环同色字；`HDR 高亮` 在 worker 内把头像画布转为线性 HDR 浮点图，再用 `hdrify` 写成 Ultra HDR JPEG gain map。HDR 预览直接使用 `<img>` Blob，避免画回 Canvas 被压成 SDR。

### URL 状态

控件被编码为紧凑的短键 query（如 `?t=勇攀高峰&fl=bs&gc=08e-9cf`），只写入与默认值不同的项。编解码逻辑见 [`searchParams.ts`](src/sticker/config/searchParams.ts)。`m=simple` 会进入简易模式：页面只展示生成图和返回编辑按钮，方便 iframe 嵌入预览。

## 项目结构

```
src/
├── App.tsx                    # 页面壳：组合控制面板与预览面板
├── router/router.ts           # TanStack Router 配置
├── shared/                    # 真共享组件与底层 runtime，不承载业务规则
├── styles/                    # 布局、控件、预览与基础 UI 样式
├── avatar/
│   ├── index.ts               # avatar 根入口：配置、URL 与渲染核心
│   ├── core.ts                # avatar core 入口：可注入 runtime 的渲染核心
│   ├── node.ts                # avatar node 入口：PNG Buffer API
│   ├── components/            # 头像控制面板、预览面板
│   ├── hooks/                 # 状态、URL 同步、预览与导出副作用
│   ├── config/                # 控件模型、URL query、worker 协议
│   ├── render/                # 圆形头像渲染与自适应排版
│   └── worker/                # worker 入口与通信封装
└── sticker/
    ├── index.ts               # npm 根入口：预设、配置、URL 与配色纯逻辑
    ├── core.ts                # npm core 入口：可注入 runtime 的渲染核心
    ├── node.ts                # npm node 入口：默认 Node runtime 与 PNG Buffer API
    ├── components/            # 控制面板、预览面板
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
- 西文字体：Inter Latin Bold 拉丁子集（来自 `inter-ui/web-latin/Inter-Bold-subset.woff2`，启用 `ss01` / `ss04`）
- Emoji / Symbol fallback：优先使用运行环境可用的 Apple Color Emoji、Apple Symbols、Segoe UI Emoji、Segoe UI Symbol、Noto Color Emoji、Noto Sans Symbols 2

抖音美好体与优设标题黑均为免费商用字体；Inter 遵循其开源许可证。

## 免责声明

内置预设中的文案仅供效果演示，不代表任何立场，也与相关企业无官方关联。请勿用于可能引起误解或侵权的场合。

# 高峰生成器

浏览器里的中文「攀登体」表情包生成器。输入文字，即时生成带彩色渐变、描边与错位攀登效果的贴纸，一键复制图片或分享链接。

**在线体验** · [GitHub Pages](https://zhousiru.github.io/scale-new-heights-generator)

## 特性

- **两种风味**
  - **勇攀高峰**（抖音美好体）：白色字形置于彩色渐变包体内，配深色边缘轮廓。
  - **字节范**（优设标题黑）：彩色渐变字形，带同色系深色外轮廓。
- **错位攀登**：词与词以高低错落的基线「攀登」，也可切换为对齐平铺。
- **文本 / 图标倾斜**：可分别开关字面固有的旋转、斜切；圆形/徽章类图标自动保持直立。
- **前缀图标**：接入 [Iconify](https://iconify.design/)，输入 `mdi:rocket`、`tabler:planet` 等 id 即可作为前缀字形。
- **智能配色**
  - 支持 1~3 个渐变停靠点，附方向旋钮。
  - 单色自动在 OKLCH 空间补出同色系深色，高饱和色降深时适度收 chroma，避免刺眼。
  - 随机配色从均衡色相桶取样，避开与当前色过近的区间，不会老是随机到粉紫。
- **27 个内置预设**，按「字节范 / 勇攀高峰 / 务实浪漫系列 / 地震级创意」分组。
- **高级设置**：描边厚度、行高、上下/左右留白等。
- **可分享 URL**：所有控件状态同步到 query（仅序列化非默认值），链接即状态。
- **导出**：复制图片到剪贴板、导出 PNG（iframe 内改为新标签页打开）、复制生成链接。
- 跟随系统的深色模式。

## 技术栈

- [React 19](https://react.dev/) + [React Compiler](https://react.dev/learn/react-compiler)
- [Vite 8](https://vite.dev/)（Rolldown）+ TypeScript（strict）
- [TanStack Router](https://tanstack.com/router) —— URL 状态同步
- Web Worker + `OffscreenCanvas` —— 离主线程渲染
- [colord](https://github.com/omgovich/colord) —— 颜色处理
- [@iconify/react](https://iconify.design/) —— 图标
- [Vitest](https://vitest.dev/) + ESLint

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
| `pnpm build` | 类型检查 + 生产构建（`tsc -b && vite build`） |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm test` | 运行 Vitest 单测 |
| `pnpm lint` | 运行 ESLint |

## 工作原理

渲染是这个项目的核心，分工如下：

- **渲染引擎**（[`renderSticker.ts`](src/sticker/renderSticker.ts)）：在 `OffscreenCanvas` 上完成排版、字形整形、蒙版膨胀（描边）、渐变填充与裁剪。为避免阻塞 UI，它运行在 [Web Worker](src/sticker/renderSticker.worker.ts) 内。
- **渐变沿实际形状铺设**：`createLinearGradient` 的坐标是画布全局坐标，不随形状走。引擎会扫描文字蒙版像素在渐变方向上的投影范围来定义渐变线，让端点色真正落在可见像素两端，而非被画布外区域「吃掉」。
- **Emoji 原生彩色叠加**：Emoji 被排除在描边蒙版之外，最后以系统原生彩色单独绘制，避免被着色成纯色、也避免其抗锯齿边缘产生描边杂点。
- **图标栅格化在主线程**（[`iconLoader.ts`](src/sticker/iconLoader.ts)）：Chromium 只能在主线程栅格化 SVG，因此图标先在主线程拉取并绘制为 `ImageBitmap`，再转移进 worker。
- **配色算法**（[`color.ts`](src/sticker/color.ts)）：单色补深、随机取色、gamut 收敛等，均有 [单测](src/sticker/color.test.ts) 覆盖。

### URL 状态

控件被编码为紧凑的短键 query（如 `?t=勇攀高峰&fl=bs&gc=08e-9cf`），只写入与默认值不同的项。编解码逻辑见 [`searchParams.ts`](src/sticker/searchParams.ts)。在 iframe 内地址栏由父页控制，路由改用内存 history，避免与宿主争抢 URL。

## 项目结构

```
src/
├── App.tsx                    # 主界面与控件
├── AngleKnob.tsx              # 渐变方向旋钮
├── router/router.ts           # TanStack Router 配置
└── sticker/
    ├── defaults.ts            # 控件模型、默认值与规整
    ├── presets.ts             # 内置预设与分组
    ├── color.ts               # 配色算法（OKLCH 补深、随机取色）
    ├── searchParams.ts        # 控件 <-> URL query 编解码
    ├── iconLoader.ts          # 主线程 Iconify SVG 栅格化
    ├── stickerWorker.ts       # worker 通信封装
    ├── renderSticker.worker.ts# worker 入口
    ├── renderSticker.ts       # 渲染引擎
    └── workerProtocol.ts      # worker 消息协议
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

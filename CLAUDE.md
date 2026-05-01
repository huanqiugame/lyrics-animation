# 逐字歌词动效编辑器

基于 Web 的逐字歌词动效编辑器。导入 AMLL TTML Tool 生成的 TTML 逐词时间码文件，配置动画效果（模糊→清晰、上下滚动），同步音频实时预览，导出渲染配置。

## 技术栈约束

- **纯原生 HTML/CSS/JS** — 不使用任何前端框架（React/Vue 等）
- **无构建工具** — 不依赖 Vite/Webpack/pnpm，浏览器直接加载 ES modules
- **浏览器原生 API** — DOM API、CSS Animations、Web Audio API、FileReader/Blob
- **零外部运行时依赖** — 所有功能用浏览器原生能力实现

## 目录结构

```
lyrics-animation/
├── index.html              # 入口页面
├── CLAUDE.md               # 本文件
├── css/
│   ├── main.css            # 全局样式、CSS 变量、布局
│   ├── editor.css          # 编辑器面板样式
│   ├── preview.css         # 动画预览区样式
│   └── timeline.css        # 时间轴样式
├── js/
│   ├── app.js              # 应用入口，初始化各模块
│   ├── ttml/
│   │   ├── parser.js       # TTML 文本 → 内部数据模型
│   │   ├── writer.js       # 内部数据模型 → TTML 文本
│   │   └── types.js        # 数据模型定义
│   ├── audio/
│   │   └── engine.js       # 音频播放控制
│   ├── animation/
│   │   ├── renderer.js     # 动画渲染引擎
│   │   └── config.js       # 动画配置模型
│   ├── ui/
│   │   ├── shell.js        # 主布局
│   │   ├── file-io.js      # 文件导入导出
│   │   ├── lyric-list.js   # 歌词列表组件
│   │   ├── lyric-detail.js # 逐词编辑
│   │   ├── param-panel.js  # 动画参数面板
│   │   ├── timeline.js     # 时间轴可视化
│   │   └── preview.js      # 预览区控制
│   └── utils/
│       ├── time.js         # 时间戳解析/格式化
│       ├── dom.js          # DOM 辅助函数
│       └── events.js       # 事件总线
├── test/
│   ├── Helping Hands.ttml   # 测试 TTML 文件
│   └── X-0 Helping Hands 伸出援手.mp3  # 测试音频
└── memory/                 # AI 会话记忆
```

## 数据模型

所有时间单位为**毫秒**（整数）。

### LyricWord（逐词）
| 字段 | 类型 | 说明 |
|------|------|------|
| word | string | 词文本 |
| startTime | number | 开始时间（ms） |
| endTime | number | 结束时间（ms） |
| style | WordStyle \| null | 逐字样式覆盖，null=使用全局样式 |

### LyricLine（歌词行）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识（itunes:key） |
| words | LyricWord[] | 逐词数组 |
| translatedLyric | string | 翻译文本 |
| romanLyric | string | 音译文本 |
| startTime | number | 整行开始时间（ms） |
| endTime | number | 整行结束时间（ms） |
| isDuet | boolean | 对唱行标记 |
| style | LineStyle \| null | 逐行样式覆盖 |

### AnimationConfig（全局动画配置，独立 JSON）
- `blur.enabled` / `blur.startAmount` / `blur.endAmount` / `blur.duration`
- `scroll.enabled` / `scroll.direction` / `scroll.distance` / `scroll.easing`
- `text.fontFamily` / `text.fontSize` / `text.color` / `text.textShadow` / `text.stroke`

### 样式覆盖约定
- `null` = 使用全局配置，非 `null` = 覆盖
- 逐字样式覆盖写入 TTML span 的自定义属性（命名空间 `lv:`，如 `lv:scale="1.5"`）
- 全局 AnimationConfig **不写入 TTML**，存储在独立 JSON 文件中
- WordStyle 可选字段：`scale`, `color`, `bold`
- LineStyle 可选字段：`scale`, `color`

## 模块依赖与通信

```
app.js（协调层）
  ├── ttml/parser.js      ← 纯函数，无依赖
  ├── ttml/writer.js      ← 纯函数，无依赖
  ├── audio/engine.js     ← EventTarget，派发音频事件
  ├── animation/renderer.js ← 接收 lyrics+config，暴露 updateTime()
  └── ui/*.js             ← DOM 组件，通过事件总线通信
```

**事件总线**（`js/utils/events.js`）：全局 `EventTarget` 实例，模块间通过它解耦通信。

关键事件：
- `audio:timeupdate` → `{ currentTime }` — 驱动动画同步
- `audio:play` / `audio:pause` / `audio:loaded`
- `lyrics:loaded` → `{ project }` — 解析完成
- `lyrics:modified` → `{ project }` — 歌词数据变更
- `config:changed` → `{ config }` — 动画参数变更

## 关键约定

1. **时间单位**：内部全部使用毫秒（整数），仅在解析/序列化 TTML 时转换为 `MM:SS.mmm` 格式
2. **样式覆盖**：null = 使用全局配置；非 null = 覆盖（合并策略：只覆盖设置的字段）
3. **TTML 命名空间**：
   - 标准命名空间：`ttm:` (metadata), `tts:` (styling), `itunes:` (Apple)
   - 自定义命名空间：`lv:` (lyric-vfx)，用于逐字样式覆盖属性
4. **浏览器兼容**：目标 Chrome/Safari/Firefox 最新版，使用 ES modules (`<script type="module">`)
5. **文件编码**：TTML 文件使用 UTF-8
6. **无外部依赖**：任何功能优先考虑浏览器原生 API 实现，禁止引入 npm 包或 CDN 库

## 开发命令

```bash
# 启动本地开发服务器（在项目根目录运行）
python3 -m http.server 8080

# 浏览器打开
open http://localhost:8080

# 运行纯 JS 模块的单元测试
/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node --input-type=module -e "..."

# 代码量统计
wc -l js/**/*.js css/*.css index.html
```

## Git 规范

- **每个 Phase 完成后进行一次 git commit**，在测试通过后提交
- commit message 格式：`Phase N: 简短描述`
- 不在 commit 中包含大型二进制文件（音频、视频），已通过 `.gitignore` 排除

## 关联项目

- `../amll-ttml-tool-reference/` — 原始 AMLL TTML Tool 的克隆（GPLv3），仅作 TTML 格式参考，不可直接复用代码

## 当前状态

- [x] 项目分析完成：决定从零开发（amll-ttml-tool 代码高度耦合 React，不可复用）
- [x] Phase 1: TTML 解析器 + 数据模型
- [ ] Phase 2: 基础 UI 外壳 + 文件 IO
- [ ] Phase 3: 音频引擎
- [ ] Phase 4: 动画渲染引擎 + 预览
- [ ] Phase 5: 动画参数控制面板
- [ ] Phase 6: 逐词样式覆盖 + 导出
- [ ] Phase 7: 时间轴可视化 + 拖拽排序

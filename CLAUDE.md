# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 逐字歌词动效编辑器

基于 Web 的逐字歌词动效编辑器。导入 AMLL TTML Tool 生成或标准的 TTML 逐词时间码文件，编辑逐词/逐行动画效果（不透明度、模糊、颜色、文字阴影、描边、3D 变换等可通过动画组自由组合），同步音频实时预览，导出带动画配置的 TTML。

## 技术栈约束

- **纯原生 HTML/CSS/JS** — 不使用任何前端框架（React/Vue 等），无构建工具
- **CSS 框架**：Bulma v1（class-based，`<link>` CDN 引入，仅影响 `.class` 选择器，不污染原生元素）
- **自定义 CSS**：3 个文件（`main.css` 全局变量/按钮/输入框，`editor.css` 编辑器布局，`animation.css` 画布）
- **浏览器原生 API** — DOM API、CSS Animations、Web Audio API、FileReader/Blob
- **代码缩进**：使用 **4 个空格** 缩进

## 架构

```
app.js（协调层）
  ├── ttml/parser.js       ← 纯函数，TTML → ProjectData
  ├── ttml/writer.js       ← 纯函数，ProjectData → TTML
  ├── audio/engine.js      ← EventTarget，派发音频事件
  ├── config-loader.js     ← 全局动画配置加载器，管理预设切换
  ├── animation/
  │   ├── renderer.js      ← 接收 project，暴露 updateTime()
  │   ├── resolver.js      ← AnimationGroup 评估引擎（5 级优先级链 + 硬编码最终回退）
  │   ├── channels.js      ← 20+ 动画通道（opacity/blur/color/transform 等）
  │   ├── easing.js        ← 12+ 缓动曲线预设 + 自定义贝塞尔
  │   └── anchors.js       ← 锚点系统（transform-origin）
  ├── ui/
  │   ├── shell.js         ← 布局外壳
  │   ├── file-io.js       ← 文件导入/导出
  │   ├── lyric-list.js    ← 歌词列表
  │   ├── playback.js      ← 播放控制
  │   ├── param-panel.js   ← 动画组编辑器（全局/行级/字级）
  │   └── ...              ← 后续 UI 组件
  └── utils/
      ├── events.js        ← EventBus
      ├── dom.js           ← DOM 辅助函数
      └── time.js          ← 时间戳转换
```

**事件总线**（`js/utils/events.js`）：`EventBus extends EventTarget`，提供 `emit/on/off`。`on()` 用 `WeakMap` 保存包装函数引用确保 `off()` 正确移除。

关键事件：
- `lyrics:loaded` → `{ project }` — 解析完成
- `lyrics:modified` → `{ project }` — 歌词/动画数据变更
- `config:changed` → `{ config }` — 全局动画配置变更
- `audio:timeupdate` → `{ currentTime }` — 驱动动画同步
- `audio:play` / `audio:pause` / `audio:loaded`
- `ui:selectLine` → `{ lineId, line, index }` — 选中歌词行
- `ui:selectWord` → `{ lineIndex, wordIndex, word }` — 选中逐词
- `ui:animEdit` → `{ target, anim_groups }` — 动画组编辑完成
- `ui:modeChange` → `{ mode }` — 编辑/预览模式切换

## 关键约定

1. **时间单位**：内部全部使用毫秒（整数），TTML 解析/序列化时用 `parseTimespan`/`msToTimestamp` 转换 `MM:SS.mmm` 格式
2. **样式覆盖**：`null` = 使用全局配置；非 `null` = 覆盖
3. **全局动画配置**：**不写入 TTML**，存储在独立 JSON 文件。逐行/逐字的动画组（`anim_groups`）通过 `lv:` 命名空间写入 TTML。默认全局动画组预设位于 `configs/default/`，通过 `js/config-loader.js` 管理
4. **TTML 样式**：导入的 `<styling>` 块原样保留，不自作修改
5. **优先级链**：字动画组 > 行动画组 > 全局字动画组 > 全局行动画组 > 默认全局动画组（`default_anim_config`） > 硬编码最终回退（`resolver.js` 的 `HARDCODED_DEFAULTS`）
6. **选择器**：parser 中查询命名空间元素（`ttm:agent` 等）用 `getElementsByTagName`，比 `querySelector` 更兼容 `xmlns=""` 的情况
7. **时间锚点**：`offset: null` 表示"无限"（始终在参考点之前/之后），UI 中用 ∞ 按钮切换。`offset: 0` 表示"恰好在该时间点"，语义不同
8. **折叠状态持久化**：用 `WeakMap` 以数据对象为 key 存储折叠状态。拖拽重排后对象引用不变，状态自动跟随

## 代码风格

- **缩进**：使用 4 个空格
- **变量命名**：局部变量和对象属性使用 `snake_case`（如 `start_time`、`is_duet`）
- **保留驼峰**：
  - 类名、构造函数：`AudioEngine`、`EventBus`（PascalCase）
  - DOM API 调用：`createElement`、`getElementById`
  - CSS 属性名：`el.style.fontSize`
  - 导出函数名：`parseTTML`、`writeTTML`

详细数据模型见 `docs/data-model.md`，TTML 格式支持见 `docs/ttml-format.md`。

## 开发命令

```bash
npm install          # 安装测试依赖（jsdom，运行时不需要）
npm test             # 通过 test/runner.mjs 逐个测试所有 .mjs 文件并汇总结果
node --check js/ttml/parser.js  # 语法检查
python3 -m http.server 8080     # 启动开发服务器
```

Node 路径：`/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node`（nvm 管理）

## 技能

- `testing-check-pattern`（`.claude/skills/testing-check-pattern/`）— 测试文件编写规范：check/section 断言模式、jsdom 前置设置、runner 集成要求

## Git 规范

- 每个 Phase 完成后 commit，在测试通过后提交
- commit message：`Phase N: 简短描述`
- 不 commit 大型二进制文件（音频、视频），`node_modules/` 已排除

## 已知问题

- **`<input type="range">` 滑块不到头**：浏览器对 range input 的默认行为（thumb 宽度），等后期统一调样式时修复
- **不支持**：`amll:obscene`、`amll:empty-beat`、`<transliterations>`（均为 AMLL 非标准属性，见 `docs/ttml-format.md`）

## 当前状态

### 已完成
- [x] Phase 1: TTML 解析器 + 数据模型
- [x] Phase 2: 基础 UI 外壳 + 文件 IO + 事件总线
- [x] Phase 2b: TTML 标准扩展格式支持（多 agent/背景人声/styling/region/div）
- [x] Phase 3: 音频引擎
- [x] Phase 4: 动画渲染引擎 + 字幕模式预览（channels/resolver/easing/anchors）
- [x] Phase 5: 动画组编辑器 UI + 优先级链（靠上优先） + 拖拽排序
- [x] Phase 5: 动画组/通道折叠 + 全部展开/折叠 + 拖拽后折叠状态保持（WeakMap）
- [x] Phase 5: 时间锚点 ∞/± 无限模式切换按钮
- [x] Phase 5: 硬编码默认动画组提取为独立预设配置文件（barely-minimum），通过 config-loader 加载

### 待完成（原 Phase 6 已拆分为 14 个模块，详见 `.claude/plan.md`）
- [x] `lv:` 动画组序列化到 TTML（parser/writer）— 已在 Phase 5 完成
- [x] 导出 TTML + 动画配置 JSON — 已在 Phase 5 完成
- [ ] 模块 1: 播放高亮（蓝色背景标记当前唱到的行/字）
- [ ] 模块 2: 双击跳转（双击行/字跳转到开始时间）
- [ ] 模块 3: 快速时间跳转（点击当前时间输入跳转）
- [ ] 模块 4: 焦点管理 + Tab 导航
- [ ] 模块 5: 方向键导航 + Delete 删除
- [ ] 模块 6: 动画组作用域过滤器（all/standard/duet/background）
- [ ] 模块 7: 多选行/字应用动画组
- [ ] 模块 8: 复制/粘贴动画组和通道
- [ ] 模块 9: 自定义曲线管理 UI
- [ ] 模块 10: 自定义曲线配置集成
- [ ] 模块 11: 时间轴框架 + 播放头
- [ ] 模块 12: 时间轴词块渲染
- [ ] 模块 13: 时间轴动画组视图
- [ ] 模块 14: 时间轴缩放与滚动

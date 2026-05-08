# 数据模型参考

所有时间单位为**毫秒**（整数）。类型定义位于 `js/ttml/types.js`，运行时数据使用 `snake_case` 属性名。

## LyricWord（逐词）

| 字段 | 类型 | 说明 |
|------|------|------|
| word | string | 词文本 |
| start_time | number | 开始时间（ms） |
| end_time | number | 结束时间（ms） |
| style | WordStyle \| null | 逐字样式覆盖，null=使用全局样式 |
| style_ref | string \| null | 引用的 TTML `<style>` id |
| anim_groups | AnimationGroup[] | 逐字动画组 |

## LyricLine（歌词行）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识（itunes:key） |
| words | LyricWord[] | 逐词数组 |
| translated_lyric | string | 翻译文本 |
| roman_lyric | string | 音译文本 |
| start_time | number | 整行开始时间（ms） |
| end_time | number | 整行结束时间（ms） |
| is_duet | boolean | 对唱行标记 |
| is_background | boolean | 背景人声行（agent type != "person"） |
| agent_id | string | 关联的 `ttm:agent` id |
| style | LineStyle \| null | 逐行样式覆盖 |
| style_ref | string \| null | 引用的 TTML `<style>` id |
| region_id | string \| null | 所属的 `<region>` id |
| anim_groups | AnimationGroup[] | 逐行动画组 |

## AgentInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | `xml:id` |
| type | string | `"person"` \| `"group"` \| `"other"` |
| name | string | `<ttm:name>` 文本 |

AMLL 格式兼容：仅有 1 个 `person` agent 时，`type="other"` 的 agent 视为对唱搭档。多 `person` agent 时，`other`/`group` 视为背景人声。

## TtmlStyle

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | `xml:id` |
| properties | Record<string, string> | `tts:*` 属性（键已去掉 `tts:` 前缀） |

## RegionInfo

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | `xml:id` |
| origin | string | `tts:origin`，如 `"10% 75%"` |
| extent | string | `tts:extent`，如 `"80% 20%"` |
| text_align | string | `tts:textAlign` |
| display_align | string | `tts:displayAlign` |
| style_ref | string \| null | 引用的 style id |

## ProjectData

| 字段 | 类型 | 说明 |
|------|------|------|
| version | number | 固定为 1 |
| title | string \| null | `<ttm:title>` |
| lang | string | `xml:lang`（默认 `"en-US"`） |
| lyrics | LyricLine[] | 歌词行数组 |
| agents | AgentInfo[] | 所有声明的 agent |
| styles | Record<string, TtmlStyle> | id → style 定义 |
| regions | Record<string, RegionInfo> | id → region 定义 |
| anim_config | AnimationConfig | 全局动画配置 |
| audio_file_name | string \| null | 关联的音频文件名 |

## WordStyle（逐字样式覆盖）

| 字段 | 类型 | 说明 |
|------|------|------|
| scale | number | 缩放倍数，如 1.5 |
| color | string | CSS 颜色 |
| bold | boolean | 加粗 |

写入 TTML 时使用 `lv:` 命名空间属性（`lv:scale`, `lv:color`, `lv:bold`）。

## LineStyle（逐行样式覆盖）

字段同 WordStyle，但仅支持 `scale` 和 `color`。

## TimeAnchor（时间锚点）

| 字段 | 类型 | 说明 |
|------|------|------|
| ref | string | `'wordStart'` \| `'wordEnd'` \| `'lineStart'` \| `'lineEnd'` |
| dir | string | `'before'`（之前）\| `'after'`（之后） |
| offset | number \| null | 偏移量（毫秒），before 为减去、after 为加上。`null` 表示无限大（dir=before 为负无限，dir=after 为正无限）。也可直接用 `Infinity` / `-Infinity`。 |

**无限大示例**：
- `{ ref: "wordStart", dir: "before", offset: null }` → 负无限（任何时间都在此锚点之后）
- `{ ref: "lineEnd", dir: "after", offset: null }` → 正无限（任何时间都在此锚点之前）

## AnimChannel（动画通道）

| 字段 | 类型 | 说明 |
|------|------|------|
| channel_id | string | 通道 ID（如 `'opacity'`、`'blur'`、`'color'`、`'translateY'`、`'anchorPosition'` 等，见 channels.js） |
| from | any | 起始值 |
| to | any | 结束值 |
| curve | string | 缓动曲线 ID（如 `'linear'`、`'ease-out'`，见 easing.js） |

**锚点相关通道**：
- `anchorPosition` — 锚点位置（画布参考点）：`'center'` | `'topLeft'` | `'topRight'` | `'bottomLeft'` | `'bottomRight'` | `'top'` | `'bottom'` | `'left'` | `'right'`，step 切换不可插值
- `anchorOffsetX` — 锚点 X 偏移（像素），可插值
- `anchorOffsetY` — 锚点 Y 偏移（像素），可插值
- `anchorOffsetZ` — 锚点 Z 偏移（translateZ，像素），可插值

**锚点定位逻辑**：
1. 根据锚点位置确定画布上的参考点坐标
2. 根据文字对齐方式（textAlign）确定行元素的对齐边
3. 行元素的对齐边与画布参考点对齐
4. 应用 X/Y/Z 偏移量

**对齐方式与锚点关系**：
- `textAlign: left` → 行左端与锚点对齐，`justify-content: flex-start`
- `textAlign: center` → 行中心与锚点对齐，`justify-content: center`
- `textAlign: right` → 行右端与锚点对齐，`justify-content: flex-end`

## AnimationGroup（动画组）

一个动画组定义一段时间窗口内一组动画通道的插值行为。

| 字段 | 类型 | 说明 |
|------|------|------|
| start | TimeAnchor | 动画开始时间锚点 |
| end | TimeAnchor | 动画结束时间锚点 |
| channels | AnimChannel[] | 动画通道列表（同一时间窗口内同时应用） |

**优先级链（4 级）**：字动画组 > 行动画组 > 全局字动画组 > 全局行动画组

**评估逻辑**：
1. 计算 `start` 和 `end` 锚点的绝对时间，形成 `[t_start, t_end]` 窗口
2. 当前时间 `t` 在窗口内时，计算进度 `progress = (t - t_start) / (t_end - t_start)`
3. 对每个通道，用 `curve` 缓动函数处理 `progress`，再用 channel 的 `lerp(from, to, eased)` 插值

**TTML 序列化格式**（暂定，通过 `lv:` 命名空间写入 `<span>` 或 `<p>` 元素）：

```xml
<span begin="00:01.000" end="00:02.000"
      lv:anim-groups='[{"start":{"ref":"wordStart","dir":"before","offset":500},"end":{"ref":"wordStart","dir":"after","offset":0},"channels":[{"channel_id":"opacity","from":0,"to":1,"curve":"linear"},{"channel_id":"blur","from":8,"to":0,"curve":"ease-out"}]}]'>
```

## AnimationConfig（全局动画配置）

独立 JSON 文件，**不写入 TTML**。

```
{
  line_anim_groups: AnimationGroup[],   ← 全局行动画组（所有行默认）
  word_anim_groups: AnimationGroup[],   ← 全局字动画组（所有字默认）
}
```

**默认配置**（定义于 `types.js`）：
- **全局字动画组**：包含 3 个默认组
  1. 基础样式组（-∞ ~ +∞）：设置 fontFamily、fontSize、color、textShadow、textStroke
  2. 出现动画（wordStart ~ wordStart+50ms）：opacity 0→1
  3. 消失动画（lineEnd ~ lineEnd+50ms）：opacity 1→0
- **全局行动画组**：包含 1 个默认组
  1. 基础样式组（-∞ ~ +∞）：设置 textAlign=center

## 样式/动画覆盖约定

- `null` = 使用全局配置；非 `null` = 覆盖
- 逐字/逐行样式覆盖写入 TTML 的 `lv:` 自定义属性
- 逐字/逐行动画组通过 `lv:anim-groups` JSON 属性写入 TTML
- 全局 AnimationConfig 不写入 TTML，存储在独立 JSON 文件中
- 从 TTML 导入的 `<styling>` 块原样保留（`style_ref`），不自作修改

# 数据模型参考

所有时间单位为**毫秒**（整数）。类型定义位于 `js/ttml/types.js`。

## LyricWord（逐词）

| 字段 | 类型 | 说明 |
|------|------|------|
| word | string | 词文本 |
| startTime | number | 开始时间（ms） |
| endTime | number | 结束时间（ms） |
| style | WordStyle \| null | 逐字样式覆盖，null=使用全局样式 |
| styleRef | string \| null | 引用的 TTML `<style>` id |

## LyricLine（歌词行）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识（itunes:key） |
| words | LyricWord[] | 逐词数组 |
| translatedLyric | string | 翻译文本 |
| romanLyric | string | 音译文本 |
| startTime | number | 整行开始时间（ms） |
| endTime | number | 整行结束时间（ms） |
| isDuet | boolean | 对唱行标记 |
| isBackground | boolean | 背景人声行（agent type != "person"） |
| agentId | string | 关联的 `ttm:agent` id |
| style | LineStyle \| null | 逐行样式覆盖 |
| styleRef | string \| null | 引用的 TTML `<style>` id |
| regionId | string \| null | 所属的 `<region>` id |

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
| textAlign | string | `tts:textAlign` |
| displayAlign | string | `tts:displayAlign` |
| styleRef | string \| null | 引用的 style id |

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
| animConfig | AnimationConfig | 全局动画配置 |
| audioFileName | string \| null | 关联的音频文件名 |

## WordStyle（逐字样式覆盖）

| 字段 | 类型 | 说明 |
|------|------|------|
| scale | number | 缩放倍数，如 1.5 |
| color | string | CSS 颜色 |
| bold | boolean | 加粗 |

写入 TTML 时使用 `lv:` 命名空间属性（`lv:scale`, `lv:color`, `lv:bold`）。

## LineStyle（逐行样式覆盖）

字段同 WordStyle，但仅支持 `scale` 和 `color`。

## AnimationConfig（全局动画配置）

独立 JSON 文件，**不写入 TTML**。

```
{
  blur:    { enabled, startAmount(px), endAmount(px), duration("word"|"line") }
  scroll:  { enabled, direction("up"|"down"), distance(vh), easing }
  text:    { fontFamily, fontSize(px), color, textShadow, stroke }
}
```

## 样式覆盖约定

- `null` = 使用全局配置；非 `null` = 覆盖
- 逐字/逐行样式覆盖写入 TTML 的 `lv:` 自定义属性
- 全局 AnimationConfig 不写入 TTML，存储在独立 JSON 文件中
- 从 TTML 导入的 `<styling>` 块原样保留（`styleRef`），不自作修改

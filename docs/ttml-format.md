# TTML 格式支持参考

## 命名空间

```
xmlns     = "http://www.w3.org/ns/ttml"
xmlns:ttm = "http://www.w3.org/ns/ttml#metadata"  
xmlns:tts = "http://www.w3.org/ns/ttml#styling"
xmlns:itunes = "http://music.apple.com/lyric-ttml-internal"
xmlns:lv  = "http://www.example.com/ns/lyric-vfx"
```

- `lv:` 是我们自研渲染引擎使用的自定义命名空间，标准解析器会安全忽略
- 导入的 TTML 中可能包含其他自定义命名空间（如 `myanim:`），均被安全忽略

## 已支持特性

| 类别 | 特性 | 说明 |
|------|------|------|
| 时间 | `begin` / `end` 属性 | `MM:SS.mmm` / `HH:MM:SS.mmm` 格式 |
| 内容 | `<p>` 歌词行 | 必需 begin/end |
| 内容 | `<span>` 逐词 | 逐词时间码 |
| 内容 | `<div>` 段落分组 | 含 region 属性继承 |
| 元数据 | `<ttm:title>` | 歌曲标题 |
| 元数据 | `<ttm:agent>` | 含 `<ttm:name>` 子元素 |
| 元数据 | `xml:lang` | 文档语言 |
| 样式 | `<styling>` → `<style>` | 原样保留，通过 `styleRef` 引用 |
| 样式 | `style="id"` 引用 | 在 `<p>` 和 `<span>` 上 |
| 布局 | `<layout>` → `<region>` | 含 origin/extent/textAlign/displayAlign |
| 布局 | `region="id"` 关联 | 在 `<div>` 和 `<p>` 上 |
| 对唱 | 多 person agent | `isDuet=true` 标识 |
| 背景人声 | agent type="other"/"group" | `isBackground=true` 标识 |
| 翻译 | `<span ttm:role="x-translation">` | 行级翻译文本 |
| 音译 | `<span ttm:role="x-roman">` | 行级音译文本 |
| 自定义样式 | `lv:scale` / `lv:color` / `lv:bold` | 逐字/逐行样式覆盖 |
| Apple | `itunes:key` | 行唯一标识 |
| Apple | `itunes:timing` | "Word" / "Line" |

## Agent 类型判断逻辑

- **AMLL 格式**（仅 1 个 `person` agent + `other` 类型 agent）：`other` → 对唱搭档 (`isDuet=true`)
- **标准格式**（多个 `person` agent + `other`/`group`）：`other`/`group` → 背景人声 (`isBackground=true`)
- 对唱行：agent 非主 agent 且 type 为 `person`

## 明确不支持

| 特性 | 说明 |
|------|------|
| `amll:obscene="true"` | AMLL 专有，非标准 |
| `amll:empty-beat="<NUMBER>"` | AMLL 专有，非标准 |
| `<transliterations>` | `<head>` 中的逐词音译块 |
| `<set>` 元素 | TTML 2.0 关键帧，暂不引入 |
| `<br>` 换行 | TTML 规范推荐用 `<p>` 分行 |

## 测试覆盖

三份测试文件位于 `test/` 和 `test/ttml_examples/`：

| 文件 | 特性 |
|------|------|
| `Helping Hands.ttml` | AMLL 导出格式：v1/v2 duet, lv: scale, x-translation, x-roman |
| `ttml_examples/standard_only.ttml` | 纯 W3C 标准：多 person agent, styling, region, background |
| `ttml_examples/full_features.ttml` | 标准 + 自定义 `myanim:` 命名空间 |

运行 `npm test` 验证所有文件的解析和双向转换一致性。

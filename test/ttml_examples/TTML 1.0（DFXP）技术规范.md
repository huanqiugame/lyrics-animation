# TTML 1.0（DFXP）技术规范


## 一、概述

TTML 1.0（Timed Text Markup Language 1.0），在 W3C 建议发布之初也称为 DFXP（Distribution Format Exchange Profile）。TTML 1.0 是 W3C 制定的基于 XML 的语言，用于描述需要在时间上与音频或视频内容同步的文本内容（如歌词、字幕、隐藏式字幕）。

本规范面向歌词动效渲染导出的开发场景，基于 **TTML 1.0 + 自定义扩展** 的架构策略。TTML 1.0 提供了一个可被所有标准解析器识别的时间轴和文本框架，而自定义命名空间则用于承载专属驱动动画效果的属性，两者的分离确保了文件标准兼容性与动效扩展能力的统一。


## 二、XML 基础规范

### 2.1 UTF-8 编码与 BOM

TTML 1.0 文件必须使用 UTF-8 或 UTF-16 编码。XML 解析器被要求支持这两种编码，因此在实际应用中，建议使用 **UTF-8 编码**。

- **文件开头必须包含编码声明**：`<?xml version="1.0" encoding="UTF-8"?>`
- **禁止使用 BOM（Byte Order Mark）**：UTF-8 编码的文件不得以 BOM 开头，以避免某些解析器在处理时出现错误。

### 2.2 文档类型

TTML 遵循标准 XML 格式，要求文档：

- XML 结构良好（所有标签必须正确闭合、正确嵌套）
- 不允许出现未经转义的 XML 敏感字符（如 `<`、`>`、`&` 等）
- 文本内容中的特殊字符必须使用预定义的 XML 实体转义：
  - `&` → `&amp;`
  - `<` → `&lt;`
  - `>` → `&gt;`
  - `"` → `&quot;`
  - `'` → `&apos;`


## 三、文档结构

TTML 文档由根元素 `<tt>` 及其内部的 `<head>` 和 `<body>` 组成。

```
<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="..." xmlns:tts="..." xml:lang="...">
  <head>
    <metadata />
    <styling />
    <layout />
  </head>
  <body>
    <div>...</div>
  </body>
</tt>
```

### 3.1 根元素 `<tt>`

`<tt>` 是所有 TTML 文档的根元素，必须声明以下核心命名空间：

| 前缀  | 命名空间 URI                                  | 说明            |
| ----- | --------------------------------------------- | --------------- |
| 默认  | `http://www.w3.org/ns/ttml`                   | TTML 核心词汇表 |
| `tts` | `http://www.w3.org/ns/ttml#styling`           | 样式属性集合    |
| `ttp` | `http://www.w3.org/ns/ttml#parameter`（可选） | 文档参数        |
| `ttm` | `http://www.w3.org/ns/ttml#metadata`（可选）  | 元数据元素      |

这三个 `xmlns`（默认、`tts`、`ttp`）是 TTML 解析器的基本识别依据，建议完整声明。

此外，`<tt>` 元素还必须包含 `xml:lang` 属性，用于指定文档的默认语言。

### 3.2 头部 `<head>`

`<head>` 是可选的，但其内容对于规范文档具有重要的语义价值。`<head>` 内部可包含三个主要子元素：

- **`<metadata>`**：文档级元数据，如歌曲标题、演唱者信息、版权声明等
- **`<styling>`**：样式定义，供内容元素重复引用
- **`<layout>`**：布局定义，指定内容呈现的区域位置和方式

### 3.3 主体 `<body>`

`<body>` 包含实际歌词内容。建议使用 `dur` 属性给出歌曲的完整时长（格式如 `dur="02:51.030"`），便于播放器知晓总时长。

### 3.4 超时行为与 timeContainer 时间容器

`<body>`、`<div>`、`<p>` 等支持时序属性的层级元素，在构建父子级联时间轴时，都隐式受到了 `timeContainer` 属性的影响。通常行为表现如下：

- 子层的 `begin`/`end` 总是以父层（或更上层）的相对时间为基准进行计算。
- 如果父级元素同时有 `timeContainer="par"`（并行，默认值），会允许同一父级下的子元素各自独立并行播放。
- 如果父级元素设置成 `timeContainer="seq"`（顺序），会强制子元素按顺序先后播放，不允许重叠。

TTML 1.0 默认不要求显式声明时基。但当需要明确行为时，可以直接在 `<tt>` 顶部通过 `ttp:timeBase` 属性设置时间的参照基准。

- `ttp:timeBase="media"` 表示时间与外部媒体（如音频、视频）的时间轴绑定，常用在歌词文件中。
- `ttp:timeBase="clock"` 表示时间与真实世界时钟（如 UTC 或 GPS）同步。


## 四、内容结构元素

### 4.1 段落容器 `<div>`

`<div>` 表示一个歌词段落（如主歌、副歌），可以包含一个或多个 `<p>` 元素（行）。

```xml
<div begin="00:07.621" end="00:45.268">
    <p>...</p>
</div>
```

### 4.2 行 `<p>`

`<p>` 表示歌词的一行。在歌词应用中，**应使用 `<p>` 来分隔歌词行，请勿使用 `<br>` 换行符**。

每个 `<p>` 应包含 `begin` 和 `end` 属性来标记该行的显示时间区间。时间可以以父元素相对时间，也可以以绝对时间表达。一般情况下所有 `<p>` 的时间都会基于 `<body>` 或媒体的起始点进行绝对计算。

```xml
<p begin="00:07.621" end="00:10.267" ttm:agent="v1">
    I don't wanna be alone tonight
</p>
```

### 4.3 字词级容器 `<span>`

`<span>` 用于标记歌词行中个别字词或短语的精细时间信息，实现词级甚至音节级的同步。

```xml
<p begin="00:07.621" end="00:10.267">
    <span begin="00:07.621" end="00:07.920">I</span>
    <span begin="00:07.920" end="00:08.253">don't</span>
    <span begin="00:08.253" end="00:08.739">wanna</span>
    <span begin="00:08.739" end="00:09.103">be</span>
</p>
```

TTML 1.0 原生设计中，时序只能由 `begin`、`end` 等属性驱动，没有基于采样或波形的时间控制。

### 4.4 层级关系与时间语义逻辑

TTML 1.0 有明确的内容层级关系。除标准结构外，在 `<p>` 级别可以嵌入 `<span>` 以标记字词。符合规范的解析器会严格按照以下逻辑来计算每个文本块的实际显示时间：

1. **计算有效时间**：每个 `<p>` 的有效显示时间区间是其自身 `begin` 和 `end` 定义的区间，但受限于父元素 `<div>` 的区间约束。
2. **时间区间的切分**：如果子元素的时间区间超出父元素的时间区间，解析器会自动截断超出部分。
3. **逐词时间优先于行时间**：当 `<p>` 和 `<span>` 都提供时间信息时，解析器应以 `<span>` 的时间为准进行逐级渲染，`<p>` 的起止时间仅为后备信息。


## 五、样式系统

### 5.1 样式属性（`tts:` 前缀）

TTML 样式属性使用 CSS 风格的命名，通过 `tts:` 前缀标识。所有样式属性都支持标准 CSS 语法（如 `#FFFFFF` 十六进制颜色、`px` 和 `%` 单位等）。

常用样式属性：

| 属性                  | 说明     | 示例值                                              |
| --------------------- | -------- | --------------------------------------------------- |
| `tts:fontFamily`      | 字体系列 | `"Helvetica, Arial, sans-serif"`                    |
| `tts:fontSize`        | 字体大小 | `"100%"`, `"18px"`, `"1.5c"`                        |
| `tts:fontWeight`      | 粗体     | `"bold"`, `"normal"`                                |
| `tts:fontStyle`       | 斜体     | `"italic"`, `"normal"`                              |
| `tts:color`           | 文字颜色 | `"white"`, `"#FFFF00"`                              |
| `tts:backgroundColor` | 背景色   | `"black"`, `"rgba(0,0,0,0.5)"`                      |
| `tts:textAlign`       | 水平对齐 | `"center"`, `"start"`, `"end"`, `"left"`, `"right"` |
| `tts:displayAlign`    | 垂直对齐 | `"center"`, `"before"`, `"after"`                   |
| `tts:textDecoration`  | 文字装饰 | `"underline"`, `"noUnderline"`                      |
| `tts:opacity`         | 透明度   | `"1.0"`, `"0.5"`                                    |

### 5.2 内联样式

直接在内容元素上通过 `tts:` 属性设置样式：

```xml
<p tts:color="white" tts:fontSize="100%" tts:textAlign="center">
    This is styled inline.
</p>
```

### 5.3 引用样式（Referential Styling）

在 `head/styling` 中预定义样式，并通过 `style` 属性引用。这种方式避免了样式的重复定义。

```xml
<head>
    <styling>
        <style xml:id="defaultStyle"
               tts:fontFamily="sansSerif"
               tts:fontSize="100%"
               tts:color="white" />
        <style xml:id="highlightStyle"
               tts:color="yellow"
               tts:fontWeight="bold" />
    </styling>
</head>

<p style="defaultStyle">
    <span style="highlightStyle">This is highlighted</span>
</p>
```

### 5.4 样式继承与覆盖

可继承的样式属性（如 `tts:color`、`tts:fontFamily`、`tts:textAlign` 等）会自动传递给所有后代元素。子元素可以通过显式指定相同名称的样式属性来覆盖继承值。

不可继承的样式属性（如 `tts:backgroundColor`）必须在目标元素上显式指定。


## 六、布局系统（`<layout>` 与 `<region>`）

### 6.1 基础布局区域

TTML 使用 `<region>` 来定义内容呈现的位置和范围。

```xml
<layout>
    <region xml:id="bottomCenter"
            tts:origin="10% 75%"
            tts:extent="80% 20%"
            tts:textAlign="center"
            tts:displayAlign="after" />
</layout>
```

### 6.2 区域定位公式

`tts:origin="x y"` 指定区域左上角相对于根容器左上角的位置。`tts:extent="width height"` 指定区域的宽度和高度。

**TTML 1.0 允许的定位公式组合：**

- **百分比组合**：`origin="10% 80%"` `extent="80% 15%"`（最通用、响应式）
- **像素绝对值组合**：如 `origin="120px 540px"` `extent="800px 108px"`
- **单元格组合**：如果文档显式声明了 `ttp:cellResolution="32 15"`（单元格网格分辨率），原点坐标也可用单元格对齐，例如 `origin="3c 12c"`
- **混合单位不建议**：比如 `origin="10% 540px"` 在解析器间行为差异较大，应避免使用。

TTML 标准规定当区域内容超出 `extent` 设定范围时，应根据 `tts:overflow` 属性决定处理方式。为简化逻辑、避免不可预知的截断，歌词应用建议将溢出行为设为可见或宽松的自动换行方式。

### 6.3 区域样式

区域可以引用预定义的样式，使区域内所有内容自动继承该样式：

```xml
<region xml:id="main" style="defaultStyle" ... />
```

### 6.4 将内容关联到区域

通过 `region` 属性将段落关联到目标区域：

```xml
<div region="main">
    <p>This appears in the main region.</p>
</div>
```


## 七、时序表达式

### 7.1 时间码格式

TTML 支持多种时间表达式。最常用且最具可读性的是标准计时格式：

| 格式类型                       | 语法           | 示例                           |
| ------------------------------ | -------------- | ------------------------------ |
| 标准时钟时间                   | `HH:MM:SS.mmm` | `"00:07:21.500"`, `"00:01:30"` |
| 秒数                           | `数值[s]`      | `"90.5s"`, `"90s"`             |
| 毫秒                           | `数值[ms]`     | `"750ms"`, `"5000ms"`          |
| 帧数（需声明 `ttp:frameRate`） | `数值[f]`      | `"30f"`                        |
| 小时                           | `数值[h]`      | `"0.042h"`                     |

### 7.2 时序属性

所有内容元素（`<body>`、`<div>`、`<p>`、`<span>`）均可使用 `begin` 和 `end` 属性定义显示区间：

```xml
<p begin="00:01:30.500" end="00:01:35.200">
    Text to display
</p>
```

如果不提供 `end` 或 `duration`，解析器将不能确定内容的结束时间。

根据 TTML 1.0 的标准实现，`begin` 和 `end` 必须同时提供、缺一不可。


## 八、多演唱者支持（对唱 Duet）

### 8.1 声明演唱者（`<ttm:agent>`）

在 `<metadata>` 中通过 `<ttm:agent>` 声明所有演唱者：

```xml
<metadata>
    <ttm:title>Song Title</ttm:title>
    <ttm:agent type="person" xml:id="singerA">
        <ttm:name type="full">Singer A</ttm:name>
    </ttm:agent>
    <ttm:agent type="person" xml:id="singerB">
        <ttm:name type="full">Singer B</ttm:name>
    </ttm:agent>
    <ttm:agent type="group" xml:id="chorus">
        <ttm:name type="full">Chorus</ttm:name>
    </ttm:agent>
</metadata>
```

`type` 属性可取值：`"person"`（个人）、`"group"`（团体）、`"other"`（其他情形）。`ttm:name` 元素中的 `type="full"` 用于提供演唱者的完整名称。

### 8.2 关联演唱者（`ttm:agent` 属性）

在 `<p>` 或 `<span>` 元素中添加 `ttm:agent` 属性，指明内容由哪位演唱者表演：

```xml
<!-- 整行关联 -->
<p begin="00:07.621" end="00:10.267" ttm:agent="singerA">
    I don't wanna be alone tonight
</p>
```

### 8.3 同一行内不同演唱者

通过 `<span>` 级别的 `ttm:agent` 属性，可在单个字词级别指定演唱者：

```xml
<p begin="01:00.000" end="01:05.000">
    <span begin="01:00.000" end="01:02.000" ttm:agent="singerA">I</span>
    <span begin="01:02.000" end="01:05.000" ttm:agent="singerB">love</span>
</p>
```

在上面的例子中，`<span>` 的子级 `<span>` 标签与 `<p>` 标签同级时的嵌套结构，在 TTML 1.0 中是被允许的，但这种嵌套可能因严格的文本约束导致渲染结果不一致。建议将所有时间码放在 `<span>` 层级的单词上，避免在一个 `<p>` 内出现混合的 `<span>` 与纯文本混合结构。此外，如果元素链中既指定了 `ttm:agent`，又指定了 `ttm:name`，解析器在不同样式下可能只取其中一个而舍弃另一个，导致归属信息丢失。


## 九、自定义扩展

### 9.1 自定义命名空间

由于自定义属性可能由多个模块（不同的渲染引擎）同时使用，为了避免特定前缀冲突和跨工具兼容性问题，强烈建议不要使用仅包含个人前缀的通用命名空间（如 `myanim:`）。命名空间作为稳定 URI 更具永久性，例如抽象成 `xmlns:custom="https://example.com/ns/my-custom-lyric-export"`。

如果同一个文件里有多个自定义命名空间，解析逻辑会独立处理。但为了渲染端解析可靠，所有自定义属性仍应在一个内部规范中统一梳理。以下是一个有效命名空间的声明示例：

```xml
<tt xmlns="http://www.w3.org/ns/ttml"
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    xmlns:myanim="http://yourcompany.com/ns/ttml-animation"
    xml:lang="en-US">
```

### 9.2 自定义属性的使用范围与解析器行为

在实际行业规范中，对自定义命名空间属性的约束和主流解析器的行为差异往往体现在如下几个层面：

- **标准解析器**：严格遵循 W3C TTML 1.0 规范，只允许官方空间路径（如 `tts:color`）。现代 TTML 解析器遇到非标准前缀时，则会查看是否命中自定义或供应商特定的路径表。
- **松散解析器**：对于不在标准命名空间中的属性，依照“安全忽略”原则处理（宽松版和严格版）。
- **严格模式**：如果开启了严格模式（例如通过 `ttp:profile` 强制约束文件结构），解析器可能警告或报错，但通常很少直接停止解析。

### 9.3 使用示例

```xml
<p begin="00:02.000" end="00:06.000"
   myanim:enter="slideUp"
   myanim:duration="0.4s"
   myanim:exit="fadeOut">
    Text with custom animation attributes
</p>
```

### 9.4 设计原则

为了确保与各类主流播放器的最大兼容性，同时保留渲染引擎所需的扩展能力，建议遵循以下原则：

- **DO（推荐）**：
  - 自定义命名空间属性（如 `myanim:enter`、`myanim:duration`）只用于控制扩展动画效果
  - 官方标准属性（`tts:` 开头）只用于标准文本样式（颜色、字体、尺寸等）
  - 使用明确的语义命名（如 `myanim:enter` 表示进场动画，`myanim:hover` 表示悬停时的样式）
  - 避免在同一个元素上同时使用官方属性和自定义属性来实现同一个视觉效果，以免造成混乱

- **DON'T（不推荐）**：
  - 不要给自定义属性分配包含任意字符的空名称
  - 不要试图覆盖或禁用任何官方的命名空间
  - 避免在 `<body>` 或 `<div>` 等高级容器上使用相同的自定义属性名来控制不同的动画
  - 不要依赖特定解析器对未知属性的宽容度来承载关键业务逻辑（如歌词数据本身）


## 十、完整文件规范

### 10.1 基础文件结构清单

一份有效的 TTML 1.0 歌词文件必须满足以下条件：

- **编码声明正确**：`<?xml version="1.0" encoding="UTF-8"?>`
- **UTF-8 编码**：文件以 UTF-8 编码存储，不含 BOM
- **根元素完整**：`<tt>` 元素必须包含 `xmlns` 默认命名空间和 `xmlns:tts` 样式命名空间
- **包含语言声明**：`xml:lang="..."` 提供默认语言
- **层级结构正确**：`<tt>` → `<body>` → `<div>` → `<p>`（不可直接使用 `<br>` 换行）
- **时序属性完整**：所有 `<p>` 和 `<span>` 元素同时包含 `begin` 和 `end` 属性

### 10.2 编码规范

- XML 声明必须位于文件第 1 行、第 1 个字符位置
- 空白紧缩（如没有额外空行）有助于避免传统解析器识别错误
- 所有元素和属性名称必须小写（TTML 词汇表区分大小写）
- 属性值必须使用双引号包裹


## 十一、版本与配置文件对照

| 配置文件              | 标准依据                  | 主要用途             | 与 TTML 1.0 的关系                        |
| --------------------- | ------------------------- | -------------------- | ----------------------------------------- |
| **DFXP Full**         | W3C TTML 1.0              | 全功能 TTML 文件     | 完整 TTML 1.0 标准的直接实现              |
| **DFXP Presentation** | W3C TTML 1.0              | 最小合规子集         | TTML 1.0 的子集，用于要求最低兼容性的场景 |
| **IMSC 1.0/1.1**      | W3C                       | 互联网字幕交付       | 基于 TTML 的约束性配置文件                |
| **iTT**               | W3C TTML 1.0 + Apple 扩展 | Apple Music 歌词交付 | TTML 1.0 的超集，添加了 Apple 特有扩展    |

对于歌词动效渲染导出的场景，推荐使用 **DFXP Full**（即完整的 TTML 1.0）作为基础规范，既满足平台移植的通用性，又支持后期自定义扩展。


## 十二、常见问题

**Q1：`<p>` 元素中可以包含纯文本和 `<span>` 混合吗？**

**A1：可以。** TTML 1.0 允许 `<p>` 同时包含纯文本字符串和 `<span>` 子元素。纯文本会被视为匿名文本段落，应用 `<p>` 层级的样式。但在涉及精细时间控制时，推荐将所有文本内容都包含在带时序属性的 `<span>` 中，以确保时间同步的精确性。

**Q2: `<div>` 或 `<p>` 的未闭合标签会导致什么后果？**

**A2：任何未能正确闭合的 `<xml>` 标签都会使整个 TTML 成为“非良构 XML”**，被解析器依据基本 XML 标准拒绝加载、降级或抛错。为避免该风险，开发时应使用 XML 语法标准验证工具进行校验。

**Q3：自定义命名空间的属性是否会被标准解析器报错？**

**A3：不会报错。** 根据 TTML 规范，解析器对于不在标准命名空间中的属性采用“安全忽略”的原则。自定义属性不会影响标准属性的解析，也不会导致文件被拒绝。但需注意，如果在 `<tt>` 根元素中未正确声明对应的命名空间 URI，解析器将无法将该前缀与合法 URI 关联，进而可能拒绝整个文件。

**Q4：如何测试 TTML 文件是否规范？**

**A4：可以使用在线 TTML 验证器（如 quicklrc 提供的 TTML Validator）进行检查，该类工具会验证 XML 结构是否正确、命名空间声明是否完整、时序属性格式是否合规。**

**Q5：`<tt>` 根元素中的 `xml:lang` 是否必须有？**

**A5：在 TTML 1.0 规范中，`xml:lang` 在 `<tt>` 元素上是可选的，但仍然强烈建议在全球根元素上指定默认语言，以便渲染过程中继承和辅助工具正确处理不同语言的文本。**
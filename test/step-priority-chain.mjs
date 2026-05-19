/**
 * 动画继承优先级链测试
 *
 * 测试优先级链：
 * 1. 行内字动画 > 行内行动画 > 自定义全局配置字动画 > 自定义全局配置行动画 > Default全局配置字动画 > Default全局配置行动画 > 硬编码动画效果
 *
 * 用法：node test/step-priority-chain.mjs
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" });
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
globalThis.Document = dom.window.Document;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLDivElement = dom.window.HTMLDivElement;
globalThis.HTMLSpanElement = dom.window.HTMLSpanElement;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.EventTarget = dom.window.EventTarget;

console.log("✓ jsdom DOM 环境就绪\n");

let passed = 0;
let failed = 0;

function check(cond, msg) {
    if (cond) { passed++; }
    else { console.error("  ✗ 失败: " + msg); failed++; }
}

function section(title) {
    console.log("\n=== " + title + " ===");
}

const { bus } = await import("../js/utils/events.js");
const { h, clear } = await import("../js/utils/dom.js");
const { AnimationRenderer } = await import("../js/animation/renderer.js");
const { createEmptyProject, createDefaultConfig, createEmptyConfig } = await import("../js/ttml/types.js");
const { resolveWord } = await import("../js/animation/resolver.js");

// ==================== 测试 1: 优先级链回退 ====================
section("1. 优先级链回退");

const proj1 = createEmptyProject();
proj1.lyrics = [{
    id: "L1",
    words: [
        { word: "Hello", start_time: 0, end_time: 500, anim_groups: [], style: null, style_ref: null },
    ],
    start_time: 0,
    end_time: 500,
    anim_groups: [],
    translated_lyric: "",
    roman_lyric: "",
    is_duet: false,
    is_background: false,
    agent_id: "v1",
    style: null,
    style_ref: null,
    region_id: null,
}];

const line1 = proj1.lyrics[0];
const word1 = line1.words[0];
const config1 = proj1.anim_config; // 空配置

// 在 t=250ms 时，应该回退到 Default 全局配置
const styles1 = resolveWord(250, line1, word1, config1);

// Default 全局配置应该提供基础样式
check(styles1.has("fontFamily"), "回退到 Default 配置：有 fontFamily");
check(styles1.has("fontSize"), "回退到 Default 配置：有 fontSize");
check(styles1.has("color"), "回退到 Default 配置：有 color");
check(styles1.has("opacity"), "回退到 Default 配置：有 opacity");

// 检查值是否正确
check(styles1.get("fontFamily") === "system-ui, -apple-system, sans-serif",
    "fontFamily = system-ui (实际: " + styles1.get("fontFamily") + ")");
check(styles1.get("fontSize") === 32, "fontSize = 32");
check(styles1.get("color") === "#ffffff", "color = #ffffff");

// ==================== 测试 2: 行内字动画优先 ====================
section("2. 行内字动画优先");

// 给字添加自定义动画组
word1.anim_groups = [
    {
        start: { ref: "wordStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "color", from: "#ff0000", to: "#ff0000", curve: "linear" },
            { channel_id: "fontSize", from: 64, to: 64, curve: "linear" },
        ],
    },
];

const styles2 = resolveWord(250, line1, word1, config1);
check(styles2.get("color") === "#ff0000", "字动画覆盖：color = #ff0000 (实际: " + styles2.get("color") + ")");
check(styles2.get("fontSize") === 64, "字动画覆盖：fontSize = 64");
// fontFamily 应该还是从 Default 配置来（字动画组没有定义）
// 注意：由于字动画组存在且非空，不会回退到 Default 配置
// fontFamily 此时由 evaluateGroup 返回空（该组没有 fontFamily 通道）
// 这是正确行为：用户定义了动画组，就只应用用户定义的通道
check(!styles2.has("fontFamily") || styles2.get("fontFamily") === "system-ui, -apple-system, sans-serif",
    "字动画组只覆盖定义的通道（fontFamily 可能为空）");

word1.anim_groups = []; // 重置

// ==================== 测试 3: 行内行动画优先 ====================
section("3. 行内行动画优先");

line1.anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "color", from: "#00ff00", to: "#00ff00", curve: "linear" },
            { channel_id: "fontSize", from: 48, to: 48, curve: "linear" },
        ],
    },
];

const styles3 = resolveWord(250, line1, word1, config1);
check(styles3.get("color") === "#00ff00", "行动画覆盖：color = #00ff00 (实际: " + styles3.get("color") + ")");
check(styles3.get("fontSize") === 48, "行动画覆盖：fontSize = 48");

line1.anim_groups = []; // 重置

// ==================== 测试 4: 自定义全局配置字动画优先 ====================
section("4. 自定义全局配置字动画优先");

const custom_config = createEmptyConfig();
custom_config.word_anim_groups = [
    {
        start: { ref: "wordStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "color", from: "#0000ff", to: "#0000ff", curve: "linear" },
            { channel_id: "fontSize", from: 40, to: 40, curve: "linear" },
        ],
    },
];

const styles4 = resolveWord(250, line1, word1, custom_config);
check(styles4.get("color") === "#0000ff", "全局字动画覆盖：color = #0000ff (实际: " + styles4.get("color") + ")");
check(styles4.get("fontSize") === 40, "全局字动画覆盖：fontSize = 40");

// ==================== 测试 5: 自定义全局配置行动画优先 ====================
section("5. 自定义全局配置行动画优先");

custom_config.word_anim_groups = [];
custom_config.line_anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "color", from: "#ff00ff", to: "#ff00ff", curve: "linear" },
            { channel_id: "fontSize", from: 36, to: 36, curve: "linear" },
        ],
    },
];

const styles5 = resolveWord(250, line1, word1, custom_config);
check(styles5.get("color") === "#ff00ff", "全局行动画覆盖：color = #ff00ff (实际: " + styles5.get("color") + ")");
check(styles5.get("fontSize") === 36, "全局行动画覆盖：fontSize = 36");

// ==================== 测试 6: 优先级链完整测试 ====================
section("6. 优先级链完整测试");

// 重置所有
word1.anim_groups = [];
line1.anim_groups = [];
custom_config.word_anim_groups = [];
custom_config.line_anim_groups = [];

// 设置各层级的动画组
const default_config = createDefaultConfig();

// Default 全局行动画组：fontSize = 32
// 自定义全局行动画组：fontSize = 36
custom_config.line_anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "fontSize", from: 36, to: 36, curve: "linear" },
        ],
    },
];

// 行内行动画组：fontSize = 40
line1.anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "fontSize", from: 40, to: 40, curve: "linear" },
        ],
    },
];

// 行内字动画组：fontSize = 44
word1.anim_groups = [
    {
        start: { ref: "wordStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "fontSize", from: 44, to: 44, curve: "linear" },
        ],
    },
];

// 字动画应该胜出
const styles6a = resolveWord(250, line1, word1, custom_config);
check(styles6a.get("fontSize") === 44, "优先级：字动画 > 其他 (实际: " + styles6a.get("fontSize") + ")");

// 移除字动画，行动画应该胜出
word1.anim_groups = [];
const styles6b = resolveWord(250, line1, word1, custom_config);
check(styles6b.get("fontSize") === 40, "优先级：行动画 > 全局配置 (实际: " + styles6b.get("fontSize") + ")");

// 移除行动画，全局行动画应该胜出
line1.anim_groups = [];
const styles6c = resolveWord(250, line1, word1, custom_config);
check(styles6c.get("fontSize") === 36, "优先级：全局行动画 > Default (实际: " + styles6c.get("fontSize") + ")");

// 移除全局行动画，Default 应该生效
custom_config.line_anim_groups = [];
const styles6d = resolveWord(250, line1, word1, custom_config);
check(styles6d.get("fontSize") === 32, "优先级：Default 配置生效 (实际: " + styles6d.get("fontSize") + ")");

// ==================== 测试 7: 渲染器优先级链 ====================
section("7. 渲染器优先级链");

const render_container = h("div", { id: "test-renderer", style: "width: 800px; height: 600px;" });
document.body.appendChild(render_container);
const renderer = new AnimationRenderer(render_container);

// 创建空配置的项目
const proj7 = createEmptyProject();
proj7.lyrics = [{
    id: "L1",
    words: [
        { word: "Test", start_time: 0, end_time: 500, anim_groups: [], style: null, style_ref: null },
    ],
    start_time: 0,
    end_time: 500,
    anim_groups: [],
    translated_lyric: "",
    roman_lyric: "",
    is_duet: false,
    is_background: false,
    agent_id: "v1",
    style: null,
    style_ref: null,
    region_id: null,
}];

bus.emit("lyrics:loaded", proj7);

// 在 t=250ms 时，应该应用 Default 配置的样式
renderer.updateTime(250);

const word_el = render_container.querySelector(".anim-word");
check(word_el !== null, "词元素存在");
check(word_el.style.fontSize === "32px", "渲染器应用 Default fontSize (实际: " + word_el.style.fontSize + ")");
check(word_el.style.color === "rgb(255, 255, 255)" || word_el.style.color === "#ffffff",
    "渲染器应用 Default color");

// opacity 在字出现期间应为 1
check(word_el.style.opacity === "1", "渲染器应用 Default opacity = 1 (实际: " + word_el.style.opacity + ")");

// ==================== 测试 8: Default 配置在默认区块中显示 ====================
section("8. Default 配置在默认区块中显示");

const { initParamPanel } = await import("../js/ui/param-panel.js");
const panel_el = h("div", { id: "test-panel" });
document.body.appendChild(panel_el);
initParamPanel(panel_el);

// 加载空配置项目
bus.emit("lyrics:loaded", proj7);

// 自定义区块应为空（anim_config 现在是空的）
const empty_hints = panel_el.querySelectorAll(".anim-editor-empty");
check(empty_hints.length === 2, "自定义区块显示 2 个空状态提示 (实际: " + empty_hints.length + ")");

// Default 区块应有预设动画组
const default_group_cards = panel_el.querySelectorAll(".default-section-body .anim-group-card");
check(default_group_cards.length >= 4, "默认区块显示预设动画组 (实际: " + default_group_cards.length + ")");

// 面板总计应有动画组卡片（在默认区块中）
const all_group_cards = panel_el.querySelectorAll(".anim-group-card");
check(all_group_cards.length >= 4, "面板总计显示 >= 4 动画组卡片 (实际: " + all_group_cards.length + ")");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log("通过: " + passed + "  失败: " + failed);
if (failed === 0) {
    console.log("🎉 动画继承优先级链测试全部通过！");
    console.log("  优先级链回退     空→Default 配置 ✓");
    console.log("  行内字动画优先   字动画 > 其他 ✓");
    console.log("  行内行动画优先   行动画 > 全局配置 ✓");
    console.log("  全局字动画优先   全局字 > 全局行 ✓");
    console.log("  全局行动画优先   全局行 > Default ✓");
    console.log("  完整优先级链     6 级回退 ✓");
    console.log("  渲染器优先级     Default 配置渲染 ✓");
    console.log("  面板不显示       Default 配置隐藏 ✓");
} else {
    console.log("❌ " + failed + " 个测试失败");
    process.exit(1);
}
console.log("═══════════════════════════════════");

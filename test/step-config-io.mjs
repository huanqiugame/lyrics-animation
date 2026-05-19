/**
 * 全局动画配置导入导出 + default_anim_config 合并测试
 *
 * 测试内容：
 * 1. parseConfigJSON() 有效/无效输入
 * 2. writeConfigJSON + parseConfigJSON 回环
 * 3. createEmptyProject() 含 default_anim_config
 * 4. 渲染器 default_anim_config 合并
 * 5. 渲染器 custom 优先于 default
 * 6. defaultConfig:changed 事件
 * 7. 配置合并顺序（custom 组在 default 组前面）
 *
 * 用法：node test/step-config-io.mjs
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
const { writeConfigJSON, parseConfigJSON } = await import("../js/ttml/writer.js");

// ==================== 测试 1: parseConfigJSON ====================
section("1. parseConfigJSON 有效输入");

const valid_json = JSON.stringify({
    line_anim_groups: [
        { start: { ref: "lineStart", dir: "before", offset: null }, end: { ref: "lineEnd", dir: "after", offset: null }, channels: [{ channel_id: "anchorPosition", from: "left", to: "left", curve: "linear" }] },
    ],
    word_anim_groups: [
        { start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "lineEnd", dir: "after", offset: 0 }, channels: [{ channel_id: "opacity", from: 1, to: 1, curve: "linear" }] },
    ],
});

const parsed = parseConfigJSON(valid_json);
check(parsed !== null && typeof parsed === "object", "解析结果存在且为对象");
check(Array.isArray(parsed.line_anim_groups), "line_anim_groups 是数组");
check(Array.isArray(parsed.word_anim_groups), "word_anim_groups 是数组");
check(parsed.line_anim_groups.length === 1, "line_anim_groups 长度 = 1 (实际: " + parsed.line_anim_groups.length + ")");
check(parsed.word_anim_groups.length === 1, "word_anim_groups 长度 = 1 (实际: " + parsed.word_anim_groups.length + ")");
check(parsed.line_anim_groups[0].channels[0].channel_id === "anchorPosition", "解析出正确的 channel_id: anchorPosition");

section("1b. parseConfigJSON 无效输入");

try {
    parseConfigJSON("not json");
    check(false, "非法 JSON 应抛异常");
} catch (e) { check(true, "非法 JSON 抛异常: " + e.message); }

try {
    parseConfigJSON(JSON.stringify({}));
    check(false, "缺少 line_anim_groups 应抛异常");
} catch (e) { check(true, "缺少 line_anim_groups 抛异常: " + e.message); }

try {
    parseConfigJSON(JSON.stringify({ line_anim_groups: [], word_anim_groups: "not array" }));
    check(false, "word_anim_groups 非数组应抛异常");
} catch (e) { check(true, "word_anim_groups 非数组抛异常: " + e.message); }

try {
    parseConfigJSON(JSON.stringify({ line_anim_groups: [], word_anim_groups: [] }));
    check(true, "合法的空配置可通过");
} catch (e) { check(false, "空配置不应抛异常: " + e.message); }

// ==================== 测试 2: 回环 ====================
section("2. writeConfigJSON + parseConfigJSON 回环");

const src_config = {
    line_anim_groups: [
        { start: { ref: "lineStart", dir: "before", offset: null }, end: { ref: "lineEnd", dir: "after", offset: null }, channels: [{ channel_id: "textAlign", from: "left", to: "left", curve: "linear" }] },
    ],
    word_anim_groups: [
        { start: { ref: "wordStart", dir: "before", offset: 200 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [{ channel_id: "opacity", from: 0, to: 1, curve: "ease-out" }, { channel_id: "blur", from: 8, to: 0, curve: "ease-out" }] },
    ],
};

const roundtrip = parseConfigJSON(writeConfigJSON(src_config));
check(roundtrip.line_anim_groups.length === 1, "回环后 line_anim_groups 长度 = 1");
check(roundtrip.word_anim_groups.length === 1, "回环后 word_anim_groups 长度 = 1");
check(roundtrip.word_anim_groups[0].channels.length === 2, "回环后通道数 = 2 (实际: " + roundtrip.word_anim_groups[0].channels.length + ")");
check(roundtrip.word_anim_groups[0].channels[0].channel_id === "opacity", "回环后第一个通道为 opacity");
check(roundtrip.word_anim_groups[0].channels[1].curve === "ease-out", "回环后第二个通道 curve = ease-out");

// ==================== 测试 3: createEmptyProject 含 default_anim_config ====================
section("3. createEmptyProject 含 default_anim_config");

const proj = createEmptyProject();
check("default_anim_config" in proj, "default_anim_config 字段存在");
check(Array.isArray(proj.default_anim_config.line_anim_groups), "default_anim_config.line_anim_groups 是数组");
check(Array.isArray(proj.default_anim_config.word_anim_groups), "default_anim_config.word_anim_groups 是数组");
check(proj.default_anim_config.line_anim_groups.length === 2, "初始 default_anim_config.line_anim_groups 含预设 (实际: " + proj.default_anim_config.line_anim_groups.length + ")");
check(proj.default_anim_config.word_anim_groups.length === 2, "初始 default_anim_config.word_anim_groups 含预设 (实际: " + proj.default_anim_config.word_anim_groups.length + ")");
check(proj.anim_config.line_anim_groups.length === 0, "初始 anim_config.line_anim_groups 为空");
check(proj.anim_config.word_anim_groups.length === 0, "初始 anim_config.word_anim_groups 为空");

// ==================== 测试 4: 渲染器 default_anim_config 合并 ====================
section("4. 渲染器 default_anim_config 合并");

const render_container = h("div", { id: "test-renderer-merge", style: "width: 800px; height: 600px;" });
document.body.appendChild(render_container);
const renderer = new AnimationRenderer(render_container);

const proj4 = createEmptyProject();
proj4.lyrics = [{
    id: "L1",
    words: [{ word: "Hello", start_time: 0, end_time: 500, anim_groups: [] }],
    start_time: 0, end_time: 500,
    anim_groups: [], translated_lyric: "", roman_lyric: "",
    is_duet: false, is_background: false, agent_id: "v1",
    style: null, style_ref: null, region_id: null,
}];

// 清空 anim_config（自定义），设置 default_anim_config
proj4.anim_config = createEmptyConfig();
proj4.default_anim_config = createDefaultConfig(); // default 含有 fontSize=32

bus.emit("lyrics:loaded", proj4);
renderer.updateTime(250);

const word_el4 = render_container.querySelector(".anim-word");
check(word_el4 !== null, "词元素存在");
check(word_el4.style.fontSize === "32px", "default_anim_config 生效：fontSize = 32 (实际: " + word_el4.style.fontSize + ")");

// ==================== 测试 5: custom 优先于 default ====================
section("5. custom 优先于 default");

// 设置自定义配置覆盖 fontSize = 48
proj4.anim_config = {
    line_anim_groups: [],
    word_anim_groups: [
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "fontSize", from: 48, to: 48, curve: "linear" },
            ],
        },
    ],
};

bus.emit("config:changed", proj4.anim_config);
renderer.updateTime(250);

check(word_el4.style.fontSize === "48px", "custom 优先：fontSize = 48 (实际: " + word_el4.style.fontSize + ")");

// ==================== 测试 6: defaultConfig:changed 事件 ====================
section("6. defaultConfig:changed 事件");

const new_default_config = createEmptyConfig();
new_default_config.line_anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "anchorPosition", from: "center", to: "center", curve: "linear" },
        ],
    },
];

// 先重置 custom 为空
proj4.anim_config = createEmptyConfig();
bus.emit("config:changed", proj4.anim_config);

// 发送 defaultConfig:changed
bus.emit("defaultConfig:changed", new_default_config);
renderer.updateTime(250);

// 验证合并后锚点变为 center
const line_el6 = render_container.querySelector(".anim-line");
const left_pct = parseFloat(line_el6.style.left);
check(left_pct === 50, "defaultConfig:changed 后锚点为 center (left = " + left_pct + "%)");

// ==================== 测试 7: 合并顺序（custom 在 default 前面保证优先级） ====================
section("7. 配置合并顺序（custom 组优先）");

// 设置 default 提供 fontSize=32，custom 提供 fontSize=48
const proj7 = createEmptyProject();
proj7.lyrics = [{
    id: "L1",
    words: [{ word: "Test", start_time: 0, end_time: 500, anim_groups: [] }],
    start_time: 0, end_time: 500,
    anim_groups: [], translated_lyric: "", roman_lyric: "",
    is_duet: false, is_background: false, agent_id: "v1",
    style: null, style_ref: null, region_id: null,
}];

// anim_config = custom（置空）
proj7.anim_config = createEmptyConfig();
// default_anim_config = 含有 fontSize=32 和 color 的组
proj7.default_anim_config = {
    line_anim_groups: [],
    word_anim_groups: [
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "fontSize", from: 32, to: 32, curve: "linear" },
                { channel_id: "color", from: "#ffffff", to: "#ffffff", curve: "linear" },
            ],
        },
    ],
};

const render_container7 = h("div", { id: "test-renderer-order", style: "width: 800px; height: 600px;" });
document.body.appendChild(render_container7);
const renderer7 = new AnimationRenderer(render_container7);
bus.emit("lyrics:loaded", proj7);
renderer7.updateTime(250);

const word_el7 = render_container7.querySelector(".anim-word");
check(word_el7.style.fontSize === "32px", "无 custom 时 default 生效 (fontSize = 32)");

// 在 custom 中添加 fontSize=48 的组——应该覆盖 default
proj7.anim_config = {
    line_anim_groups: [],
    word_anim_groups: [
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "fontSize", from: 48, to: 48, curve: "linear" },
            ],
        },
    ],
};
bus.emit("config:changed", proj7.anim_config);
renderer7.updateTime(250);

check(word_el7.style.fontSize === "48px", "custom 覆盖 default (fontSize = 48, 实际: " + word_el7.style.fontSize + ")");

// color 应仍来自 default（custom 未定义 color）
check(word_el7.style.color === "rgb(255, 255, 255)" || word_el7.style.color === "#ffffff",
    "color 从 default 继承 (实际: " + word_el7.style.color + ")");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log("通过: " + passed + "  失败: " + failed);
if (failed === 0) {
    console.log("🎉 动画配置导入导出测试全部通过！");
    console.log("  parseConfigJSON    有效/无效输入 ✓");
    console.log("  回环              序列化→解析→一致 ✓");
    console.log("  数据模型           default_anim_config 字段 ✓");
    console.log("  renderer 合并       default_anim_config 生效 ✓");
    console.log("  custom 优先         custom 配置覆盖 default ✓");
    console.log("  defaultConfig事件  事件驱动渲染更新 ✓");
    console.log("  合并顺序           custom 组在 default 组前 ✓");
} else {
    console.log("❌ " + failed + " 个测试失败");
    process.exit(1);
}
console.log("═══════════════════════════════════");

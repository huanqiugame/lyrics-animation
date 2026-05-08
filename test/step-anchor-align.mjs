/**
 * 锚点系统 + 文字对齐 + 可见性 测试
 *
 * 测试内容：
 * - 锚点位置通道（anchorPosition）
 * - 锚点偏移通道（anchorOffsetX/Y/Z）
 * - 文字对齐通道（textAlign）与 justify-content 联动
 * - opacity=0 时 display:none 隐藏文字
 * - 渲染器锚点定位逻辑
 *
 * 用法：node test/step-anchor-align.mjs
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
const { createEmptyProject, createDefaultConfig } = await import("../js/ttml/types.js");
const { applyChannel, getChannel, CHANNELS } = await import("../js/animation/channels.js");

// ==================== 测试 1: 锚点通道定义 ====================
section("1. 锚点通道定义");

check(CHANNELS.has("anchorPosition"), "存在 anchorPosition 通道");
check(CHANNELS.has("anchorOffsetX"), "存在 anchorOffsetX 通道");
check(CHANNELS.has("anchorOffsetY"), "存在 anchorOffsetY 通道");
check(CHANNELS.has("anchorOffsetZ"), "存在 anchorOffsetZ 通道");

const anchor_pos_channel = CHANNELS.get("anchorPosition");
check(anchor_pos_channel.defaultValue === "center", "anchorPosition 默认值 = center");
check(anchor_pos_channel.lerp("left", "right", 0.3) === "left", "anchorPosition 使用 step 切换");
check(anchor_pos_channel.lerp("left", "right", 0.7) === "right", "anchorPosition step 切换在 0.5 后");

const offset_x_channel = CHANNELS.get("anchorOffsetX");
check(offset_x_channel.defaultValue === 0, "anchorOffsetX 默认值 = 0");
check(offset_x_channel.lerp(0, 100, 0.5) === 50, "anchorOffsetX 可插值");

// ==================== 测试 2: textAlign 通道 ====================
section("2. textAlign 通道");

const text_align_channel = CHANNELS.get("textAlign");
check(text_align_channel.defaultValue === "left", "textAlign 默认值 = left");

// 测试 textAlign apply 函数设置 justify-content
const test_el = document.createElement("div");
text_align_channel.apply(test_el, "left");
check(test_el.style.textAlign === "left", "textAlign = left");
check(test_el.style.justifyContent === "flex-start", "justifyContent = flex-start");

text_align_channel.apply(test_el, "center");
check(test_el.style.textAlign === "center", "textAlign = center");
check(test_el.style.justifyContent === "center", "justifyContent = center");

text_align_channel.apply(test_el, "right");
check(test_el.style.textAlign === "right", "textAlign = right");
check(test_el.style.justifyContent === "flex-end", "justifyContent = flex-end");

// ==================== 测试 3: opacity=0 时 display:none ====================
section("3. opacity=0 时 display:none");

const opacity_channel = CHANNELS.get("opacity");
const word_el = document.createElement("span");

// opacity=0 → display:none
opacity_channel.apply(word_el, 0);
check(word_el.style.opacity === "0", "opacity = 0");
check(word_el.style.display === "none", "display = none (隐藏)");

// opacity=0.5 → display 恢复
opacity_channel.apply(word_el, 0.5);
check(word_el.style.opacity === "0.5", "opacity = 0.5");
check(word_el.style.display === "", "display 恢复为空");

// opacity=1 → display 恢复
opacity_channel.apply(word_el, 1);
check(word_el.style.opacity === "1", "opacity = 1");
check(word_el.style.display === "", "display 仍为空");

// ==================== 测试 4: 默认配置锚点设置 ====================
section("4. 默认配置锚点设置");

const default_config = createDefaultConfig();
check(default_config.line_anim_groups.length === 2, "默认有 2 个行动画组");

// 第一个动画组：textAlign
const align_group = default_config.line_anim_groups[0];
check(align_group.channels[0].channel_id === "textAlign", "第一个动画组有 textAlign");
check(align_group.channels[0].from === "left", "textAlign = left");

// 第二个动画组：锚点定位
const anchor_group = default_config.line_anim_groups[1];
check(anchor_group.channels[0].channel_id === "anchorPosition", "第二个动画组有 anchorPosition");
check(anchor_group.channels[0].from === "left", "anchorPosition = left (画布左侧)");
check(anchor_group.channels[1].channel_id === "anchorOffsetX", "第二个动画组有 anchorOffsetX");
check(anchor_group.channels[1].from === 20, "anchorOffsetX = 20");

// ==================== 测试 5: 渲染器锚点定位 ====================
section("5. 渲染器锚点定位");

const render_container = h("div", { id: "test-renderer", style: "width: 800px; height: 600px;" });
document.body.appendChild(render_container);
const renderer = new AnimationRenderer(render_container);

const proj = createEmptyProject();
proj.lyrics = [
    {
        id: "L1",
        words: [
            { word: "Hello", start_time: 0, end_time: 500, anim_groups: [], style: null, style_ref: null },
            { word: "World", start_time: 500, end_time: 1000, anim_groups: [], style: null, style_ref: null },
        ],
        start_time: 0,
        end_time: 1000,
        anim_groups: [],
        translated_lyric: "",
        roman_lyric: "",
        is_duet: false,
        is_background: false,
        agent_id: "v1",
        style: null,
        style_ref: null,
        region_id: null,
    },
    {
        id: "L2",
        words: [
            { word: "Test", start_time: 1000, end_time: 1500, anim_groups: [], style: null, style_ref: null },
        ],
        start_time: 1000,
        end_time: 1500,
        anim_groups: [],
        translated_lyric: "",
        roman_lyric: "",
        is_duet: false,
        is_background: false,
        agent_id: "v1",
        style: null,
        style_ref: null,
        region_id: null,
    },
];

bus.emit("lyrics:loaded", proj);

const line_els = render_container.querySelectorAll(".anim-line");
check(line_els.length === 2, "2 行元素");

// 检查默认锚点定位（画布左侧 + X偏移20px）
const first_line = line_els[0];
// 锚点位置 left = 画布左侧 (x=0%)
check(first_line.style.left === "0%", "left = 0% (画布左侧)");
check(first_line.style.top === "50%", "top = 50% (垂直居中)");

// 检查 textAlign=left 时的 transform
// left 对齐时，行左端与锚点对齐，transform 应包含 translateX(0px + 20px)
const transform = first_line.style.transform;
check(transform.indexOf("translateX") !== -1, "transform 包含 translateX");
check(transform.indexOf("20px") !== -1 || transform.indexOf("+ 20px") !== -1, "translateX 包含 20px 偏移");

// ==================== 测试 6: 文字出现时对齐正常 ====================
section("6. 文字出现时对齐正常");

// 时间 t=250ms：第一个词 Hello 应显示（opacity≈0.5），World 隐藏（opacity=0）
renderer.updateTime(250);

const words = render_container.querySelectorAll(".anim-word");
check(words.length === 3, "3 个词元素");

const hello_word = words[0];
const world_word = words[1];

// Hello 正在出现，opacity > 0，display 应为空
check(hello_word.style.opacity !== "0", "Hello opacity > 0");
check(hello_word.style.display !== "none", "Hello display 不是 none");

// World 未出现，opacity=0，display 应为 none
check(world_word.style.opacity === "0", "World opacity = 0");
check(world_word.style.display === "none", "World display = none");

// L1 行应该只显示 Hello，World 不占空间
// 由于 World 的 display:none，行宽度应该只包含 Hello

// ==================== 测试 7: 自定义锚点位置 ====================
section("7. 自定义锚点位置");

// 创建自定义配置：锚点在画布中心，居中对齐
const custom_config = createDefaultConfig();
custom_config.line_anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "textAlign", from: "center", to: "center", curve: "linear" },
            { channel_id: "anchorPosition", from: "center", to: "center", curve: "linear" },
            { channel_id: "anchorOffsetX", from: 0, to: 0, curve: "linear" },
            { channel_id: "anchorOffsetY", from: 0, to: 0, curve: "linear" },
            { channel_id: "anchorOffsetZ", from: 0, to: 0, curve: "linear" },
        ],
    },
];

bus.emit("config:changed", custom_config);

// 检查行定位更新
renderer.updateTime(250);
const line_after = render_container.querySelector(".anim-line");

// 锚点位置 center = 画布中心 (x=50%)
check(line_after.style.left === "50%", "center 锚点: left = 50%");
check(line_after.style.top === "50%", "center 锚点: top = 50%");

// textAlign=center 时，justify-content=center
check(line_after.style.justifyContent === "center", "justifyContent = center");

// ==================== 测试 8: 右对齐锚点定位 ====================
section("8. 右对齐锚点定位");

const right_config = createDefaultConfig();
right_config.line_anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "textAlign", from: "right", to: "right", curve: "linear" },
            { channel_id: "anchorPosition", from: "right", to: "right", curve: "linear" },
            { channel_id: "anchorOffsetX", from: -20, to: -20, curve: "linear" },
            { channel_id: "anchorOffsetY", from: 0, to: 0, curve: "linear" },
            { channel_id: "anchorOffsetZ", from: 0, to: 0, curve: "linear" },
        ],
    },
];

bus.emit("config:changed", right_config);
renderer.updateTime(250);

const line_right = render_container.querySelector(".anim-line");
check(line_right.style.left === "100%", "right 锚点: left = 100%");
check(line_right.style.justifyContent === "flex-end", "justifyContent = flex-end");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log("通过: " + passed + "  失败: " + failed);
if (failed === 0) {
    console.log("🎉 锚点系统 + 文字对齐 + 可见性测试全部通过！");
    console.log("  锚点通道定义     anchorPosition/OffsetX/Y/Z ✓");
    console.log("  textAlign 通道   justify-content 联动 ✓");
    console.log("  opacity 可见性   opacity=0 → display:none ✓");
    console.log("  默认锚点配置     画布左侧 + X偏移20px ✓");
    console.log("  渲染器锚点定位   画布坐标 + 对齐方式 ✓");
    console.log("  文字出现对齐     未出现词不占空间 ✓");
    console.log("  自定义锚点       center/right 对齐 ✓");
} else {
    console.log("❌ " + failed + " 个测试失败");
    process.exit(1);
}
console.log("═══════════════════════════════════");

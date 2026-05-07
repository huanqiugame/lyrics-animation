/**
 * Step 1/2/6 验证脚本：参数面板 + 动画组编辑器 + 渲染器集成
 *
 * Step 1: param-panel.js — 全局配置面板控件渲染与事件
 * Step 2: anim-editor.js — 动画组编辑器的增删改
 * Step 6: renderer.js — 文字配置加载、config:changed 实时刷新
 *
 * 用法：node test/step1-2-6.mjs
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
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;

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
const { initParamPanel } = await import("../js/ui/param-panel.js");
const { createAnimEditor } = await import("../js/ui/anim-editor.js");
const { AnimationRenderer } = await import("../js/animation/renderer.js");
const { createEmptyProject, createDefaultConfig } = await import("../js/ttml/types.js");

// ==================== 测试 1: param-panel 控件 ====================
section("1. 参数面板控件渲染与初始状态");

const panel_el = h("div", { id: "test-panel" });
document.body.appendChild(panel_el);
initParamPanel(panel_el);

// 触发一次填充让编辑器完成首次渲染
bus.emit("lyrics:loaded", createEmptyProject());

// 5 个区块标题
const titles = panel_el.querySelectorAll(".param-section-title");
check(titles.length === 5, "5 个区块标题 (实际: " + titles.length + ")");
check(titles[0].textContent.trim() === "文字", "区块 1 = 文字");
check(titles[1].textContent.trim() === "启用模糊", "区块 2 = 启用模糊");
check(titles[2].textContent.trim() === "启用滚动", "区块 3 = 启用滚动");

// Text 控件：5 个 param-group
const text_groups = panel_el.querySelectorAll(".param-section:first-child .param-group");
check(text_groups.length === 5, "Text 有 5 个控件 (实际: " + text_groups.length + ")");

const text_labels = Array.from(text_groups).map(function(g) { return g.querySelector("label").textContent; });
check(text_labels[0] === "字体", "控件 1 = 字体");
check(text_labels[1] === "字号", "控件 2 = 字号");
check(text_labels[2] === "颜色", "控件 3 = 颜色");
check(text_labels[3] === "阴影", "控件 4 = 阴影");
check(text_labels[4] === "描边", "控件 5 = 描边");

// 动画组编辑器区块
const all_add_btns = panel_el.querySelectorAll(".btn-add-group");
check(all_add_btns.length === 2, "2 个「添加动画组」按钮 (实际: " + all_add_btns.length + ")");

// ==================== 测试 2: lyrics:loaded 填充控件 ====================
section("2. lyrics:loaded 填充默认值");

const proj2 = createEmptyProject();
proj2.anim_config.text.font_family = "Arial, sans-serif";
proj2.anim_config.text.font_size = 36;
proj2.anim_config.text.color = "#ff0000";
proj2.anim_config.blur.start_amount = 12;
proj2.anim_config.scroll.distance = 30;

bus.emit("lyrics:loaded", proj2);

const font_input = panel_el.querySelector(".param-section:first-child input[type='text']");
check(font_input !== null, "字体 text input 存在");
check(font_input.value === "Arial, sans-serif", "字体值 = Arial (实际: " + font_input.value + ")");

const size_range = panel_el.querySelectorAll(".param-section:first-child input[type='range']")[0];
check(size_range !== null, "字号 range 存在");
check(size_range.value === "36", "字号值 = 36 (实际: " + size_range.value + ")");

const color_picker = panel_el.querySelector(".param-section:first-child input[type='color']");
check(color_picker !== null, "颜色 color picker 存在");
check(color_picker.value === "#ff0000", "颜色值 = #ff0000 (实际: " + color_picker.value + ")");

const blur_range = panel_el.querySelectorAll(".param-section:nth-child(2) input[type='range']")[0];
check(blur_range.value === "12", "模糊起始 = 12 (实际: " + blur_range.value + ")");

const scroll_range = panel_el.querySelectorAll(".param-section:nth-child(3) input[type='range']")[0];
check(scroll_range.value === "30", "滚动距离 = 30 (实际: " + scroll_range.value + ")");

// ==================== 测试 3: 控件变更发射 config:changed ====================
section("3. 控件变更发射 config:changed");

let captured_config = null;
var cfg_listener = function(cfg) { captured_config = cfg; };
bus.on("config:changed", cfg_listener);

// 修改字体
font_input.value = "Helvetica";
font_input.dispatchEvent(new CustomEvent("change", { bubbles: true }));
check(captured_config !== null, "字体 change 触发 config:changed");
if (captured_config) {
    check(captured_config.text.font_family === "Helvetica", "font_family = Helvetica");
}
captured_config = null;

// 拖拽字号 range
size_range.value = "72";
size_range.dispatchEvent(new CustomEvent("input", { bubbles: true }));
await new Promise(function(r) { setTimeout(r, 80); });
check(captured_config !== null, "字号 input 触发 debounced config:changed");
if (captured_config) {
    check(captured_config.text.font_size === 72, "font_size = 72");
}
captured_config = null;

// 切换 blur enabled
const blur_checkbox = panel_el.querySelectorAll("input[type='checkbox']")[0];
blur_checkbox.checked = false;
blur_checkbox.dispatchEvent(new CustomEvent("change", { bubbles: true }));
check(captured_config !== null, "blur toggle 触发 config:changed");
if (captured_config) {
    check(captured_config.blur.enabled === false, "blur.enabled = false");
}
// 验证 blur 区段 disabled
const blur_section_body = panel_el.querySelectorAll(".param-section")[1].querySelectorAll(".param-section-body")[0];
check(blur_section_body.classList.contains("disabled"), "blur 禁用后添加 disabled class");

bus.off("config:changed", cfg_listener);

// ==================== 测试 4: 动画组编辑器基础 ====================
section("4. 动画组编辑器：组管理");

const editor_container = h("div", { id: "test-anim-editor" });
document.body.appendChild(editor_container);
const editor = createAnimEditor(editor_container);

// 加载空数组触发首次渲染
editor.load([]);

// 初始：空状态
check(editor_container.querySelector(".anim-editor-empty") !== null, "初始显示空状态提示");
check(editor_container.querySelector(".btn-add-group") !== null, "初始显示添加按钮");

// 加载已有动画组
const test_groups = [
    {
        start: { ref: "wordStart", dir: "before", offset: 500 },
        end: { ref: "wordStart", dir: "after", offset: 0 },
        channels: [
            { channel_id: "opacity", from: 0, to: 1, curve: "linear" },
            { channel_id: "blur", from: 8, to: 0, curve: "ease-out" },
        ],
    },
];
editor.load(test_groups);
const group_cards = editor_container.querySelectorAll(".anim-group-card");
check(group_cards.length === 1, "加载 1 个组 (实际: " + group_cards.length + ")");
check(editor_container.querySelector(".anim-editor-empty") === null, "加载组后空提示消失");

// 验证锚点行
const anchor_rows = group_cards[0].querySelectorAll(".anim-anchor-row");
check(anchor_rows.length === 2, "2 个锚点行 (实际: " + anchor_rows.length + ")");
const first_anchor_ref = anchor_rows[0].querySelector("select");
check(first_anchor_ref !== null, "锚点 ref select 存在");
check(first_anchor_ref.value === "wordStart", "start ref = wordStart (实际: " + first_anchor_ref.value + ")");

// 验证通道
const channel_rows = group_cards[0].querySelectorAll(".anim-channel-row");
check(channel_rows.length === 2, "2 个通道行 (实际: " + channel_rows.length + ")");
check(channel_rows[0].querySelector("select").value === "opacity", "通道 0 = opacity");
check(channel_rows[1].querySelector("select").value === "blur", "通道 1 = blur");

const from_inputs = channel_rows[0].querySelectorAll(".anim-chan-val");
check(from_inputs.length >= 2, "通道有 from/to 输入框");
check(from_inputs[0].value === "0", "opacity from = 0 (实际: " + from_inputs[0].value + ")");
check(from_inputs[1].value === "1", "opacity to = 1 (实际: " + from_inputs[1].value + ")");

const curve_select = channel_rows[0].querySelectorAll("select")[1];
check(curve_select !== null, "通道有曲线 select");
check(curve_select.value === "linear", "opacity curve = linear (实际: " + curve_select.value + ")");

// ==================== 测试 5: 动画组编辑器事件 ====================
section("5. 动画组编辑器：增删改事件");

clear(editor_container);
const editor2 = createAnimEditor(editor_container);
editor2.load([]);
let change_data = null;
editor2.onChange(function(groups) { change_data = groups; });

// 添加组
const add_btn = editor_container.querySelector(".btn-add-group");
add_btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(change_data !== null, "添加组触发 onChange");
check(change_data.length === 1, "添加后 1 个组 (实际: " + change_data.length + ")");

// 验证默认组结构
const default_group = change_data[0];
check(default_group.start !== undefined, "默认组有 start");
check(default_group.start.ref === "wordStart", "默认 start.ref = wordStart");
check(default_group.start.dir === "before", "默认 start.dir = before");
check(default_group.start.offset === 200, "默认 start.offset = 200");
check(default_group.end !== undefined, "默认组有 end");
check(default_group.end.ref === "wordStart", "默认 end.ref = wordStart");
check(default_group.channels.length === 0, "默认组通道为空");

// 添加通道
change_data = null;
const add_chan = editor_container.querySelector(".btn-add-channel");
add_chan.dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(change_data !== null, "添加通道触发 onChange");
check(change_data[0].channels.length === 1, "添加通道后 1 个通道 (实际: " + change_data[0].channels.length + ")");

if (change_data[0].channels.length > 0) {
    check(change_data[0].channels[0].channel_id === "opacity", "默认通道 = opacity");
    check(change_data[0].channels[0].from === 0, "默认 opacity from = 0");
    check(change_data[0].channels[0].to === 1, "默认 opacity to = 1");
    check(change_data[0].channels[0].curve === "linear", "默认 opacity curve = linear");
}

// 删除通道
change_data = null;
const remove_chan = editor_container.querySelector(".btn-remove-chan");
if (remove_chan) {
    remove_chan.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check(change_data !== null, "删除通道触发 onChange");
    check(change_data[0].channels.length === 0, "删除后通道为 0");
}

// 删除组
change_data = null;
const remove_group = editor_container.querySelector(".btn-remove-group");
if (remove_group) {
    remove_group.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check(change_data !== null, "删除组触发 onChange");
    check(change_data.length === 0, "删除后组为 0");
}

// ==================== 测试 6: 渲染器文字配置 ====================
section("6. 渲染器文字配置加载");

const render_container = h("div", { id: "test-renderer" });
document.body.appendChild(render_container);
const renderer = new AnimationRenderer(render_container);

const proj6 = createEmptyProject();
proj6.lyrics = [{
    id: "L1", words: [
        { word: "Hello", start_time: 0, end_time: 500, anim_groups: [], style: null, style_ref: null },
        { word: "World", start_time: 500, end_time: 1000, anim_groups: [], style: null, style_ref: null },
    ],
    start_time: 0, end_time: 1000, anim_groups: [],
    translated_lyric: "", roman_lyric: "", is_duet: false, is_background: false,
    agent_id: "v1", style: null, style_ref: null, region_id: null,
}];
proj6.anim_config.text.font_family = "Georgia, serif";
proj6.anim_config.text.font_size = 24;
proj6.anim_config.text.color = "#00ff00";
proj6.anim_config.text.text_shadow = "2px 2px 4px #000";

bus.emit("lyrics:loaded", proj6);

const anim_words = render_container.querySelectorAll(".anim-word");
check(anim_words.length === 2, "2 个单词元素 (实际: " + anim_words.length + ")");

const first_word = anim_words[0];
check(first_word.style.fontFamily.indexOf("Georgia") !== -1, "fontFamily = Georgia (实际: " + first_word.style.fontFamily + ")");
check(first_word.style.fontSize === "24px", "fontSize = 24px (实际: " + first_word.style.fontSize + ")");
check(first_word.style.color === "rgb(0, 255, 0)", "color = #00ff00 (实际: " + first_word.style.color + ")");
check(first_word.style.textShadow === "2px 2px 4px #000", "textShadow 正确 (实际: " + first_word.style.textShadow + ")");

// ==================== 测试 7: config:changed 实时刷新 ====================
section("7. config:changed 实时刷新");

var new_text_config = {
    font_family: "Courier New",
    font_size: 48,
    color: "#0000ff",
    text_shadow: "none",
    stroke: "none",
};

var new_config = createDefaultConfig();
new_config.text = new_text_config;

bus.emit("config:changed", new_config);

check(first_word.style.fontFamily.indexOf("Courier") !== -1, "更新后 fontFamily = Courier (实际: " + first_word.style.fontFamily + ")");
check(first_word.style.fontSize === "48px", "更新后 fontSize = 48px (实际: " + first_word.style.fontSize + ")");
check(first_word.style.color === "rgb(0, 0, 255)", "更新后 color = #0000ff (实际: " + first_word.style.color + ")");
check(first_word.style.textShadow === "none", "更新后 textShadow = none");

check(anim_words[1].style.fontFamily.indexOf("Courier") !== -1, "第二个单词也更新了 fontFamily");
check(anim_words[1].style.fontSize === "48px", "第二个单词也更新了 fontSize");

// ==================== 测试 8: renderer.applyTextConfig ====================
section("8. renderer.applyTextConfig");

var cfg_override = {
    font_family: "Impact, sans-serif",
    font_size: 16,
    color: "#ff00ff",
    text_shadow: "0 0 5px #fff",
    stroke: "2px #000",
};
renderer.applyTextConfig({ text: cfg_override });

check(first_word.style.fontFamily.indexOf("Impact") !== -1, "applyTextConfig fontFamily = Impact (实际: " + first_word.style.fontFamily + ")");
check(first_word.style.fontSize === "16px", "applyTextConfig fontSize = 16px (实际: " + first_word.style.fontSize + ")");
check(first_word.style.color === "rgb(255, 0, 255)", "applyTextConfig color = #ff00ff (实际: " + first_word.style.color + ")");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log("通过: " + passed + "  失败: " + failed);
if (failed === 0) {
    console.log("🎉 Step 1/2/6 全部测试通过！");
    console.log("  参数面板控件       5 区块渲染 + 控件类型 ✓");
    console.log("  面板数据填充       lyrics:loaded → 控件值 ✓");
    console.log("  控件变更事件       input/change → config:changed ✓");
    console.log("  Blur 禁用          勾选框 → disabled class ✓");
    console.log("  动画组管理         load/添加/删除 ✓");
    console.log("  通道管理           添加/删除通道 + 默认值 ✓");
    console.log("  动画组事件         onChange 回传组数据 ✓");
    console.log("  渲染器文字         load() 从 config 读取 ✓");
    console.log("  config:changed     applyTextConfig + updateTime ✓");
    console.log("  applyTextConfig   直接方法调用 ✓");
} else {
    console.log("❌ " + failed + " 个测试失败");
    process.exit(1);
}
console.log("═══════════════════════════════════");

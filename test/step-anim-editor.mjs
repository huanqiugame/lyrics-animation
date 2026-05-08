/**
 * 动画组编辑器 + 渲染器集成测试
 *
 * 测试内容：
 * - anim-editor.js: 动画组编辑器的增删改
 * - param-panel.js: 行/字动画组编辑器联动
 * - renderer.js: 默认动画组渲染
 *
 * 用法：node test/step-anim-editor.mjs
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

// ==================== 测试 1: 参数面板结构 ====================
section("1. 参数面板结构（只有行/字动画组两个区块）");

const panel_el = h("div", { id: "test-panel" });
document.body.appendChild(panel_el);
initParamPanel(panel_el);

bus.emit("lyrics:loaded", createEmptyProject());

// 2 个区块标题
const titles = panel_el.querySelectorAll(".param-section-title");
check(titles.length === 2, "2 个区块标题 (实际: " + titles.length + ")");
check(titles[0].textContent.trim() === "全局行动画组", "区块 1 = 全局行动画组");
check(titles[1].textContent.trim() === "全局字动画组", "区块 2 = 全局字动画组");

// 2 个添加按钮
const all_add_btns = panel_el.querySelectorAll(".btn-add-group");
check(all_add_btns.length === 2, "2 个「添加动画组」按钮 (实际: " + all_add_btns.length + ")");

// ==================== 测试 2: 默认动画组存在 ====================
section("2. 默认动画组配置");

const default_config = createDefaultConfig();
check(Array.isArray(default_config.word_anim_groups), "word_anim_groups 是数组");
check(Array.isArray(default_config.line_anim_groups), "line_anim_groups 是数组");
check(default_config.word_anim_groups.length === 2, "默认有 2 个字动画组 (实际: " + default_config.word_anim_groups.length + ")");
check(default_config.line_anim_groups.length === 2, "默认有 2 个行动画组 (实际: " + default_config.line_anim_groups.length + ")");

// 验证基础样式组的时间锚点（无限大）
const base_group = default_config.word_anim_groups[0];
check(base_group.start.offset === null, "基础样式组 start.offset = null (无限)");
check(base_group.end.offset === null, "基础样式组 end.offset = null (无限)");
check(base_group.start.dir === "before", "基础样式组 start.dir = before (-∞)");
check(base_group.end.dir === "after", "基础样式组 end.dir = after (+∞)");

// 验证基础样式组的通道（6 个通道：5 样式 + opacity=0）
check(base_group.channels.length === 6, "基础样式组有 6 个通道 (实际: " + base_group.channels.length + ")");
const channel_ids = base_group.channels.map(c => c.channel_id);
check(channel_ids.includes("fontFamily"), "包含 fontFamily 通道");
check(channel_ids.includes("fontSize"), "包含 fontSize 通道");
check(channel_ids.includes("color"), "包含 color 通道");

// ==================== 测试 3: 动画组编辑器基础 ====================
section("3. 动画组编辑器：组管理");

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

// ==================== 测试 4: 动画组编辑器事件 ====================
section("4. 动画组编辑器：增删改事件");

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

// ==================== 测试 5: 渲染器默认动画组渲染 ====================
section("5. 渲染器默认动画组渲染");

const render_container = h("div", { id: "test-renderer" });
document.body.appendChild(render_container);
const renderer = new AnimationRenderer(render_container);

const proj5 = createEmptyProject();
proj5.lyrics = [{
    id: "L1", words: [
        { word: "Hello", start_time: 0, end_time: 500, anim_groups: [], style: null, style_ref: null },
        { word: "World", start_time: 500, end_time: 1000, anim_groups: [], style: null, style_ref: null },
    ],
    start_time: 0, end_time: 1000, anim_groups: [],
    translated_lyric: "", roman_lyric: "", is_duet: false, is_background: false,
    agent_id: "v1", style: null, style_ref: null, region_id: null,
}];

bus.emit("lyrics:loaded", proj5);

const anim_words = render_container.querySelectorAll(".anim-word");
check(anim_words.length === 2, "2 个单词元素 (实际: " + anim_words.length + ")");

// 验证默认样式已应用（通过默认动画组）
const first_word = anim_words[0];
// fontFamily 应为 system-ui
check(first_word.style.fontFamily.indexOf("system-ui") !== -1, "fontFamily 包含 system-ui (实际: " + first_word.style.fontFamily + ")");
// fontSize 应为 32px
check(first_word.style.fontSize === "32px", "fontSize = 32px (实际: " + first_word.style.fontSize + ")");
// color 应为白色
check(first_word.style.color === "rgb(255, 255, 255)" || first_word.style.color === "#ffffff", "color = white");

// 在字开始时间时，opacity 应为 1（出现动画完成）
// 出现动画：wordStart before offset=0 (t=0) → wordStart after offset=50 (t=50)
// t=100ms 时出现动画已完成，opacity=1（覆盖基础样式组的 opacity=0）
renderer.updateTime(100);
check(first_word.style.opacity === "1", "字开始后 opacity = 1 (实际: " + first_word.style.opacity + ")");

// 在字开始前（出现动画未开始），基础样式组设置 opacity=0
// t=-100ms 时，出现动画组未激活（时间窗口 0~50ms），只有基础样式组生效
renderer.updateTime(-100);
check(first_word.style.opacity === "0", "字开始前 opacity = 0 (实际: " + first_word.style.opacity + ")");

// ==================== 测试 6: config:changed 实时刷新 ====================
section("6. config:changed 实时刷新");

// 修改全局动画组
const new_config = createDefaultConfig();
// 修改基础样式组的字体
new_config.word_anim_groups[0].channels[0].to = "Georgia, serif";
new_config.word_anim_groups[0].channels[0].from = "Georgia, serif";
// 修改字号
new_config.word_anim_groups[0].channels[1].to = 48;
new_config.word_anim_groups[0].channels[1].from = 48;

bus.emit("config:changed", new_config);

// 在有效时间点检查
renderer.updateTime(100);
check(first_word.style.fontFamily.indexOf("Georgia") !== -1, "更新后 fontFamily = Georgia (实际: " + first_word.style.fontFamily + ")");
check(first_word.style.fontSize === "48px", "更新后 fontSize = 48px (实际: " + first_word.style.fontSize + ")");

// ==================== 测试 7: 无限时间锚点解析 ====================
section("7. 无限时间锚点解析");

const { resolveTime } = await import("../js/animation/resolver.js");

const word = { start_time: 1000, end_time: 2000 };
const line = { start_time: 500, end_time: 3000 };

// 正常偏移
const normal_anchor = { ref: "wordStart", dir: "after", offset: 100 };
check(resolveTime(normal_anchor, word, line) === 1100, "正常偏移: wordStart + 100 = 1100");

// null + before = -∞
const neg_inf_anchor = { ref: "wordStart", dir: "before", offset: null };
check(resolveTime(neg_inf_anchor, word, line) === -Infinity, "null + before = -Infinity");

// null + after = +∞
const pos_inf_anchor = { ref: "lineEnd", dir: "after", offset: null };
check(resolveTime(pos_inf_anchor, word, line) === Infinity, "null + after = Infinity");

// Infinity
const inf_anchor = { ref: "wordStart", dir: "after", offset: Infinity };
check(resolveTime(inf_anchor, word, line) === Infinity, "offset = Infinity → Infinity");

// -Infinity
const neg_inf_anchor2 = { ref: "wordStart", dir: "before", offset: -Infinity };
check(resolveTime(neg_inf_anchor2, word, line) === -Infinity, "offset = -Infinity → -Infinity");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log("通过: " + passed + "  失败: " + failed);
if (failed === 0) {
    console.log("🎉 动画组编辑器 + 渲染器测试全部通过！");
    console.log("  参数面板结构     2 区块（行/字动画组）✓");
    console.log("  默认动画组       基础样式 + 出现/消失 ✓");
    console.log("  动画组编辑器     load/添加/删除 ✓");
    console.log("  通道管理         添加/删除通道 + 默认值 ✓");
    console.log("  渲染器默认       从默认动画组读取样式 ✓");
    console.log("  config:changed   实时刷新动画 ✓");
    console.log("  无限时间锚点     null/Infinity/-Infinity ✓");
} else {
    console.log("❌ " + failed + " 个测试失败");
    process.exit(1);
}
console.log("═══════════════════════════════════");

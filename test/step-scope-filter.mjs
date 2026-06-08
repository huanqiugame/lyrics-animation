/**
 * 模块 6: 动画组作用域过滤器测试
 *
 * 测试内容：
 * - AnimationGroup.scope 字段默认值
 * - 动画组编辑器中的 scope 下拉选择器
 * - param-panel 作用域过滤器按钮组
 * - resolver scope 过滤逻辑
 * - TTML roundtrip 保留 scope
 *
 * 用法：node test/step-scope-filter.mjs
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
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.EventTarget = dom.window.EventTarget;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.Event = dom.window.Event;

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
const { h } = await import("../js/utils/dom.js");
const { createAnimEditor } = await import("../js/ui/anim-editor.js");
const { initParamPanel } = await import("../js/ui/param-panel.js");
const { evaluateGroup } = await import("../js/animation/resolver.js");
const { createEmptyProject } = await import("../js/ttml/types.js");

// ==================== 测试 1: scope 字段默认值 ====================
section("1. AnimationGroup.scope 默认值");

// createEmptyGroup 是模块内部函数，通过 editor 间接测试
const test_container = h("div", {});
document.body.appendChild(test_container);
const test_editor = createAnimEditor(test_container);
test_editor.load([]);
// 点击添加按钮
const add_btn = test_container.querySelector(".btn-add-group");
add_btn.click();
const groups = test_editor.getData();
check(groups.length === 1, "添加了一个动画组");
check(groups[0].scope === "all", "默认 scope = 'all' (实际: " + groups[0].scope + ")");

// ==================== 测试 2: scope 下拉选择器 ====================
section("2. 动画组编辑器 scope 下拉选择器");

const scope_select = test_container.querySelector(".anim-group-scope");
check(!!scope_select, "scope 下拉选择器存在");
check(scope_select.value === "all", "初始值 = 'all'");

// 改为 duet
scope_select.value = "duet";
scope_select.dispatchEvent(new Event("change"));
check(groups[0].scope === "duet", "修改后 scope = 'duet' (实际: " + groups[0].scope + ")");

// 改为 background
scope_select.value = "background";
scope_select.dispatchEvent(new Event("change"));
check(groups[0].scope === "background", "修改后 scope = 'background' (实际: " + groups[0].scope + ")");

// 改回 all
scope_select.value = "all";
scope_select.dispatchEvent(new Event("change"));
check(groups[0].scope === "all", "改回 scope = 'all' (实际: " + groups[0].scope + ")");

// ==================== 测试 3: 只读模式 scope 下拉禁用 ====================
section("3. 只读模式 scope 下拉禁用");

test_editor.setReadOnly(true);
const scope_select_ro = test_container.querySelector(".anim-group-scope");
check(!!scope_select_ro, "只读模式仍有 scope 下拉");
check(scope_select_ro.disabled === true, "只读模式 scope 下拉禁用");
test_editor.setReadOnly(false);

// ==================== 测试 4: param-panel 过滤器按钮 ====================
section("4. param-panel 作用域过滤器按钮");

const panel_el = h("div", { id: "test-panel" });
document.body.appendChild(panel_el);
initParamPanel(panel_el);

const proj = createEmptyProject();
// 添加不同 scope 的全局行动画组
proj.anim_config.line_anim_groups = [
    { name: "标准组", scope: "standard", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [] },
    { name: "对唱组", scope: "duet", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [] },
    { name: "背景组", scope: "background", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [] },
    { name: "全部组", scope: "all", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [] },
];

bus.emit("lyrics:loaded", proj);

const filter_bar = panel_el.querySelector(".scope-filter-bar");
check(!!filter_bar, "过滤器按钮组存在");

const filter_btns = filter_bar.querySelectorAll(".scope-filter-btn");
check(filter_btns.length === 4, "4 个过滤器按钮 (实际: " + filter_btns.length + ")");

// 默认 "全部" 激活
check(filter_btns[0].classList.contains("active"), "默认 '全部' 激活");

// 初始显示所有 4 个组（查询 line_editor_box 内的卡片，排除默认区块）
const line_editor_box = filter_bar.nextElementSibling;
let group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 4, "默认显示 4 个动画组 (实际: " + group_cards.length + ")");

// ==================== 测试 5: 过滤器切换 ====================
section("5. 过滤器切换");

// 点击 "对唱" 过滤
filter_btns[2].click(); // "对唱"
check(!filter_btns[0].classList.contains("active"), "'全部' 不再激活");
check(filter_btns[2].classList.contains("active"), "'对唱' 已激活");

group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 1, "对唱过滤: 显示 1 个组 (实际: " + group_cards.length + ")");
check(group_cards[0].querySelector(".anim-group-title").textContent === "对唱组", "显示的是对唱组");

// 点击 "标准" 过滤
filter_btns[1].click(); // "标准"
group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 1, "标准过滤: 显示 1 个组 (实际: " + group_cards.length + ")");
check(group_cards[0].querySelector(".anim-group-title").textContent === "标准组", "显示的是标准组");

// 点击 "背景" 过滤
filter_btns[3].click(); // "背景"
group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 1, "背景过滤: 显示 1 个组 (实际: " + group_cards.length + ")");

// 点击 "全部" 恢复
filter_btns[0].click(); // "全部"
group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 4, "全部: 恢复显示 4 个组 (实际: " + group_cards.length + ")");

// ==================== 测试 6: 选中行时隐藏过滤器 ====================
section("6. 选中行时隐藏过滤器");

const test_line = proj.lyrics.length > 0 ? proj.lyrics[0] : null;
// 手动添加一行歌词用于测试
proj.lyrics.push({
    id: 1, start_time: 0, end_time: 5000, words: [], is_duet: false, is_background: false,
});
bus.emit("lyrics:loaded", proj);

// 选中行
bus.emit("ui:selectLine", { lineId: 1, line: proj.lyrics[0] });
check(filter_bar.style.display === "none", "选中行时过滤器隐藏");

// 取消选中
bus.emit("ui:selectLine", { lineId: null, line: null });
check(filter_bar.style.display === "", "取消选中后过滤器显示");

// ==================== 测试 7: resolver scope 过滤 ====================
section("7. resolver scope 过滤");

const mock_line_standard = {
    id: 1, start_time: 0, end_time: 5000, is_duet: false, is_background: false,
    words: [{ start_time: 0, end_time: 1000 }],
};
const mock_line_duet = {
    id: 2, start_time: 0, end_time: 5000, is_duet: true, is_background: false,
    words: [{ start_time: 0, end_time: 1000 }],
};
const mock_line_bg = {
    id: 3, start_time: 0, end_time: 5000, is_duet: false, is_background: true,
    words: [{ start_time: 0, end_time: 1000 }],
};

const base_group = {
    start: { ref: "wordStart", dir: "before", offset: null },
    end: { ref: "wordEnd", dir: "after", offset: null },
    channels: [{ channel_id: "opacity", from: 0, to: 1, curve: "linear" }],
};

// scope: all → 所有行都匹配
const g_all = { ...base_group, scope: "all" };
check(evaluateGroup(g_all, 500, mock_line_standard.words[0], mock_line_standard).has("opacity"), "scope=all 匹配标准行");
check(evaluateGroup(g_all, 500, mock_line_duet.words[0], mock_line_duet).has("opacity"), "scope=all 匹配对唱行");
check(evaluateGroup(g_all, 500, mock_line_bg.words[0], mock_line_bg).has("opacity"), "scope=all 匹配背景行");

// scope: standard → 仅标准行
const g_standard = { ...base_group, scope: "standard" };
check(evaluateGroup(g_standard, 500, mock_line_standard.words[0], mock_line_standard).has("opacity"), "scope=standard 匹配标准行");
check(!evaluateGroup(g_standard, 500, mock_line_duet.words[0], mock_line_duet).has("opacity"), "scope=standard 不匹配对唱行");
check(!evaluateGroup(g_standard, 500, mock_line_bg.words[0], mock_line_bg).has("opacity"), "scope=standard 不匹配背景行");

// scope: duet → 仅对唱行
const g_duet = { ...base_group, scope: "duet" };
check(!evaluateGroup(g_duet, 500, mock_line_standard.words[0], mock_line_standard).has("opacity"), "scope=duet 不匹配标准行");
check(evaluateGroup(g_duet, 500, mock_line_duet.words[0], mock_line_duet).has("opacity"), "scope=duet 匹配对唱行");
check(!evaluateGroup(g_duet, 500, mock_line_bg.words[0], mock_line_bg).has("opacity"), "scope=duet 不匹配背景行");

// scope: background → 仅背景行
const g_bg = { ...base_group, scope: "background" };
check(!evaluateGroup(g_bg, 500, mock_line_standard.words[0], mock_line_standard).has("opacity"), "scope=background 不匹配标准行");
check(!evaluateGroup(g_bg, 500, mock_line_duet.words[0], mock_line_duet).has("opacity"), "scope=background 不匹配对唱行");
check(evaluateGroup(g_bg, 500, mock_line_bg.words[0], mock_line_bg).has("opacity"), "scope=background 匹配背景行");

// 无 scope 字段 → 等同 all
const g_no_scope = { ...base_group };
check(evaluateGroup(g_no_scope, 500, mock_line_standard.words[0], mock_line_standard).has("opacity"), "无 scope 等同 all");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 模块 6 作用域过滤器全部测试通过！");
    console.log("  scope 默认值     ✓");
    console.log("  scope 下拉选择器 ✓");
    console.log("  只读模式         ✓");
    console.log("  过滤器按钮组     ✓");
    console.log("  过滤器切换       ✓");
    console.log("  选中行隐藏过滤器 ✓");
    console.log("  resolver 过滤    ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

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

// 验证 scope 在标题前面
const header = test_container.querySelector(".anim-group-header");
const scope_idx = Array.from(header.children).indexOf(scope_select);
const title_idx = Array.from(header.children).indexOf(header.querySelector(".anim-group-title"));
check(scope_idx < title_idx, "scope 下拉在标题前面 (scope idx=" + scope_idx + ", title idx=" + title_idx + ")");

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

// 默认无选中（多选模式，空 Set = 显示全部）
check(!filter_btns[0].classList.contains("active"), "默认无按钮激活");

// 初始显示所有 4 个组（查询 line_editor_box 内的卡片，排除默认区块）
const line_editor_box = filter_bar.nextElementSibling;
let group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 4, "默认显示 4 个动画组 (实际: " + group_cards.length + ")");

// ==================== 测试 5: 过滤器切换（多选多） ====================
section("5. 过滤器切换（多选多）");

// 点击 "对唱" 过滤 — 只显示 scope=duet
filter_btns[2].click(); // "对唱"
check(filter_btns[2].classList.contains("active"), "'对唱' 已激活");

group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 1, "对唱过滤: 显示 1 个组 (实际: " + group_cards.length + ")");
check(group_cards[0].querySelector(".anim-group-title").textContent === "对唱组", "显示的是对唱组");

// 再点击 "标准" — 多选：显示 duet OR standard（2 个组）
filter_btns[1].click(); // "标准"
check(filter_btns[1].classList.contains("active"), "'标准' 已激活");
group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 2, "对唱+标准: 显示 2 个组 (实际: " + group_cards.length + ")");

// 再点击 "背景" — 三选：显示 duet OR standard OR background（3 个组）
filter_btns[3].click(); // "背景"
group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 3, "对唱+标准+背景: 显示 3 个组 (实际: " + group_cards.length + ")");

// 再点击 "所有" — 四选：显示全部（4 个组）
filter_btns[0].click(); // "所有"
group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 4, "全选: 显示 4 个组 (实际: " + group_cards.length + ")");

// 取消所有 — 空 Set = 显示全部
filter_btns[0].click(); // 取消 "所有"
filter_btns[1].click(); // 取消 "标准"
filter_btns[2].click(); // 取消 "对唱"
filter_btns[3].click(); // 取消 "背景"
group_cards = line_editor_box.querySelectorAll(".anim-group-card");
check(group_cards.length === 4, "全取消: 显示 4 个组 (实际: " + group_cards.length + ")");

// ==================== 测试 6: 选中行/字时隐藏过滤器 + disableScope ====================
section("6. 选中行/字时隐藏过滤器 + disableScope");

// 添加歌词用于测试（含一个行动画组用于验证 disableScope）
proj.lyrics.push({
    id: 1, start_time: 0, end_time: 5000,
    words: [{ start_time: 0, end_time: 1000, word: "Hello", anim_groups: [{ name: "词级组", scope: "all", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordEnd", dir: "after", offset: 0 }, channels: [] }] }],
    is_duet: false, is_background: false,
    anim_groups: [{ name: "行级组", scope: "all", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordEnd", dir: "after", offset: 0 }, channels: [] }],
});
bus.emit("lyrics:loaded", proj);

// 查询行/字过滤器 DOM 引用
const line_filter_bar_dom = panel_el.querySelector(".param-section:nth-child(1) .scope-filter-bar");
const word_filter_bar_dom = panel_el.querySelector(".param-section:nth-child(2) .scope-filter-bar");

// 选中行 → 行过滤器隐藏
bus.emit("ui:selectLine", { lineId: 1, line: proj.lyrics[0] });
check(line_filter_bar_dom.style.display === "none", "选中行时行过滤器隐藏");

// 选中行时 scope 下拉应禁用（disableScope）
const line_scope_in_card = line_editor_box.querySelector(".anim-group-card .anim-group-scope");
check(!!line_scope_in_card, "选中行时仍有 scope 下拉");
check(line_scope_in_card.disabled === true, "选中行时 scope 下拉禁用");

// 取消选中行
bus.emit("ui:selectLine", { lineId: null, line: null });
check(line_filter_bar_dom.style.display === "", "取消选中行后行过滤器显示");

// 选中词 → 字过滤器隐藏
bus.emit("ui:selectWord", { lineId: 1, line: proj.lyrics[0], wordIndex: 0, word: proj.lyrics[0].words[0] });
check(word_filter_bar_dom.style.display === "none", "选中词时字过滤器隐藏");

// 选中词时 scope 下拉应禁用
const word_scope_in_card = panel_el.querySelector(".param-section:nth-child(2) .anim-group-card .anim-group-scope");
check(!!word_scope_in_card, "选中词时字级仍有 scope 下拉");
check(word_scope_in_card.disabled === true, "选中词时字级 scope 下拉禁用");

// 取消选中词
bus.emit("ui:selectWord", { lineId: null, line: null, wordIndex: null, word: null });
check(word_filter_bar_dom.style.display === "", "取消选中词后字过滤器显示");

// ==================== 测试 6b: 字作用域过滤器按钮 ====================
section("6b. 字作用域过滤器按钮");

const word_filter_bar_els = panel_el.querySelector(".param-section:nth-child(2) .scope-filter-bar");
check(!!word_filter_bar_els, "字过滤器按钮组存在");
const word_filter_btns = word_filter_bar_els.querySelectorAll(".scope-filter-btn");
check(word_filter_btns.length === 4, "字过滤器有 4 个按钮 (实际: " + word_filter_btns.length + ")");

// 给全局字动画组添加不同 scope 的组
proj.anim_config.word_anim_groups = [
    { name: "字标准组", scope: "standard", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [] },
    { name: "字对唱组", scope: "duet", start: { ref: "wordStart", dir: "before", offset: 0 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [] },
];
bus.emit("lyrics:loaded", proj);

const word_editor_box = word_filter_bar_els.nextElementSibling;
let word_cards = word_editor_box.querySelectorAll(".anim-group-card");
check(word_cards.length === 2, "字动画组默认显示 2 个 (实际: " + word_cards.length + ")");

// 点击字过滤器 "对唱"
word_filter_btns[2].click();
word_cards = word_editor_box.querySelectorAll(".anim-group-card");
check(word_cards.length === 1, "字对唱过滤: 显示 1 个 (实际: " + word_cards.length + ")");
check(word_cards[0].querySelector(".anim-group-title").textContent === "字对唱组", "显示的是字对唱组");

// 恢复
word_filter_btns[2].click();
word_cards = word_editor_box.querySelectorAll(".anim-group-card");
check(word_cards.length === 2, "字过滤器取消: 恢复 2 个 (实际: " + word_cards.length + ")");

// ==================== 测试 6c: 新增组预设 scope ====================
section("6c. 新增组预设 scope");

// 激活 "标准" 过滤
filter_btns[1].click(); // 标准
const add_btn_line = line_editor_box.querySelector(".btn-add-group");
add_btn_line.click();
const last_group = line_editor_box.querySelectorAll(".anim-group-card");
const last_card = last_group[last_group.length - 1];
const last_scope = last_card.querySelector(".anim-group-scope");
check(last_scope.value === "standard", "新增组预设 scope=standard (实际: " + last_scope.value + ")");

// 清理：取消标准过滤
filter_btns[1].click();

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
    console.log("  scope 默认值         ✓");
    console.log("  scope 下拉选择器     ✓");
    console.log("  只读模式             ✓");
    console.log("  行过滤器按钮组       ✓");
    console.log("  多选多过滤切换       ✓");
    console.log("  选中行/字隐藏+禁用   ✓");
    console.log("  字过滤器按钮组       ✓");
    console.log("  新增组预设 scope     ✓");
    console.log("  resolver 过滤        ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

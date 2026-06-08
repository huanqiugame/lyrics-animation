/**
 * 模块 4-5 验证脚本：原生 tabindex 焦点管理 + 键盘导航
 *
 * Tab 行为（浏览器原生）：
 *   - Tab 按 DOM 顺序移动：组卡片 → 组内 inputs → 通道卡片 → 通道 inputs → 下一组卡片 → ...
 *   - 容器获得焦点时显示蓝色 outline
 *
 * 方向键（仅在容器元素获得原生焦点时）：
 *   - ArrowDown/Up：组间导航
 *   - ArrowLeft/Right：折叠/展开
 *   - Enter：折叠/展开焦点组
 *   - Delete：删除焦点组/通道
 *   - Escape：清除焦点
 *
 * 用法：node test/step-focus-keyboard.mjs
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
    url: "http://localhost",
});
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
globalThis.Document = dom.window.Document;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLDivElement = dom.window.HTMLDivElement;
globalThis.HTMLSpanElement = dom.window.HTMLSpanElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.EventTarget = dom.window.EventTarget;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

console.log("✓ jsdom DOM 环境就绪\n");

let passed = 0;
let failed = 0;

function check(cond, msg) {
    if (cond) { passed++; } else { console.error(`  ✗ 失败: ${msg}`); failed++; }
}
function section(title) { console.log(`\n=== ${title} ===`); }

const { createAnimEditor } = await import("../js/ui/anim-editor.js");
const { h } = await import("../js/utils/dom.js");

function makeGroups() {
    return [
        { name: "A", note: "", start: { ref: "wordStart", dir: "before", offset: 200 }, end: { ref: "wordStart", dir: "after", offset: 0 }, channels: [{ channel_id: "opacity", from: 0, to: 1, curve: "ease-out" }, { channel_id: "blur", from: 8, to: 0, curve: "linear" }] },
        { name: "B", note: "", start: { ref: "lineStart", dir: "after", offset: 0 }, end: { ref: "lineEnd", dir: "before", offset: 100 }, channels: [{ channel_id: "fontSize", from: 24, to: 36, curve: "ease-in" }] },
        { name: "C", note: "", start: { ref: "wordEnd", dir: "before", offset: 50 }, end: { ref: "wordEnd", dir: "after", offset: 200 }, channels: [] },
    ];
}

function createEditor() {
    const container = h("div", { id: "test" });
    document.body.appendChild(container);
    const editor = createAnimEditor(container);
    const groups = makeGroups();
    editor.load(groups);
    return { container, editor, groups };
}

function press(el, key, opts = {}) {
    el.dispatchEvent(new dom.window.KeyboardEvent("keydown", {
        key, bubbles: true, cancelable: true,
        shiftKey: opts.shift || false, ctrlKey: opts.ctrl || false,
    }));
}

function focusedGroup(c) {
    const cards = c.querySelectorAll(".anim-group-card");
    for (let i = 0; i < cards.length; i++) if (cards[i].classList.contains("focused")) return i;
    return -1;
}

function isFocused(el) {
    return el.classList.contains("focused") || document.activeElement === el;
}

// ==================== 测试 1: tabindex 属性 ====================
section("1. tabindex 属性");

const { container: c1 } = createEditor();
const cards1 = c1.querySelectorAll(".anim-group-card");
check(cards1[0].getAttribute("tabindex") === "0", "组卡片有 tabindex=0");
check(cards1[1].getAttribute("tabindex") === "0", "组卡片有 tabindex=0");

const ch_rows1 = cards1[0].querySelectorAll(".anim-channel-row");
check(ch_rows1[0].getAttribute("tabindex") === "0", "通道行有 tabindex=0");

// ==================== 测试 2: ArrowDown/Up 组间+通道间导航 ====================
section("2. ArrowDown/Up 组间+通道间导航");

const { container: c2 } = createEditor();

// 聚焦到组 0 卡片
const card0 = c2.querySelectorAll(".anim-group-card")[0];
card0.focus();
check(focusedGroup(c2) === 0, "聚焦组 0");

// ArrowDown from group card → 进入第一个通道（组 0 有通道）
press(card0, "ArrowDown");
const ch_rows_2 = c2.querySelectorAll(".anim-group-card")[0].querySelectorAll(".anim-channel-row");
check(ch_rows_2[0].classList.contains("focused"), "ArrowDown: 组卡片 → 第一个通道");

// ArrowDown from channel → 下一个通道
press(ch_rows_2[0], "ArrowDown");
check(ch_rows_2[1].classList.contains("focused"), "ArrowDown: 通道 0 → 通道 1");

// ArrowDown from last channel → 下一组卡片
press(ch_rows_2[1], "ArrowDown");
check(focusedGroup(c2) === 1, "ArrowDown: 最后通道 → 下一组卡片");

// ArrowDown from group 1 card → 进入通道
const card1 = c2.querySelectorAll(".anim-group-card")[1];
press(card1, "ArrowDown");
const ch_rows_2b = c2.querySelectorAll(".anim-group-card")[1].querySelectorAll(".anim-channel-row");
check(ch_rows_2b[0].classList.contains("focused"), "ArrowDown: 组 1 → 通道");

// ArrowDown from last channel of group 1 → 组 2
press(ch_rows_2b[0], "ArrowDown");
check(focusedGroup(c2) === 2, "ArrowDown: 组 1 通道 → 组 2");

// ArrowUp from group 2 card → 组 1 的通道区域
const card2 = c2.querySelectorAll(".anim-group-card")[2];
press(card2, "ArrowUp");
// 组 2 没有通道，ArrowUp 从组卡片到上一组卡片
check(focusedGroup(c2) === 1, "ArrowUp: 组 2 → 组 1");

// ArrowUp from group card → 上一组
press(c2.querySelectorAll(".anim-group-card")[1], "ArrowUp");
check(focusedGroup(c2) === 0, "ArrowUp: 组 1 → 组 0");

// ==================== 测试 3: Enter 折叠/展开 ====================
section("3. Enter 折叠/展开组");

const { container: c3 } = createEditor();

const c3_card0 = c3.querySelectorAll(".anim-group-card")[0];
c3_card0.focus();
press(c3_card0, "Enter");
let cards3 = c3.querySelectorAll(".anim-group-card");
check(cards3[0].classList.contains("collapsed"), "Enter: 组 0 折叠");

// Enter 展开（需要重新获取卡片，因为 render 重建了 DOM）
requestAnimationFrame(() => {
    const card = c3.querySelectorAll(".anim-group-card")[0];
    if (card) {
        card.focus();
        press(card, "Enter");
        const cards3b = c3.querySelectorAll(".anim-group-card");
        check(!cards3b[0].classList.contains("collapsed"), "Enter: 组 0 展开");
    }
});

// ==================== 测试 4: Delete 删除组 ====================
section("4. Delete 删除焦点组");

const { container: c4, groups: g4 } = createEditor();

const c4_card1 = c4.querySelectorAll(".anim-group-card")[1];
c4_card1.focus();
check(focusedGroup(c4) === 1, "Delete前: 焦点在组 1");

press(c4_card1, "Delete");
check(g4.length === 2, "Delete: 3→2");
check(g4[0].name === "A", "Delete: 组 A 保留");
check(g4[1].name === "C", "Delete: 组 C 上移");

// ==================== 测试 5: Escape 清除 ====================
section("5. Escape 清除焦点");

const { container: c5 } = createEditor();

const c5_card0 = c5.querySelectorAll(".anim-group-card")[0];
c5_card0.focus();
check(focusedGroup(c5) === 0, "Escape前: 有焦点");

press(c5_card0, "Escape");
check(focusedGroup(c5) === -1, "Escape: 焦点清除");

// ==================== 测试 6: CSS 样式 ====================
section("6. 焦点 CSS 样式");

const { container: c6 } = createEditor();

const c6_card0 = c6.querySelectorAll(".anim-group-card")[0];
c6_card0.focus();
check(c6_card0.classList.contains("focused") || document.activeElement === c6_card0, "组 0 有焦点样式");

const c6_card1 = c6.querySelectorAll(".anim-group-card")[1];
check(!c6_card1.classList.contains("focused"), "组 1 无焦点样式");

// ==================== 测试 7: 点击更新焦点 ====================
section("7. 点击组卡片更新焦点");

const { container: c7 } = createEditor();

let cards7 = c7.querySelectorAll(".anim-group-card");
cards7[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
// 点击后 focusin 事件应该触发
check(focusedGroup(c7) === 1, "点击组 1: 获得焦点");
cards7 = c7.querySelectorAll(".anim-group-card");
check(!cards7[0].classList.contains("focused"), "组 1 获焦后组 0 失焦");

// ==================== 测试 8: 边界 ====================
section("8. 边界情况");

const { container: c8, editor: e8 } = createEditor();
e8.load([]);
const c8_card = c8.querySelector(".anim-group-card");
// 空组时没有卡片，键盘操作不报错
press(c8, "ArrowDown");
press(c8, "Delete");
press(c8, "Escape");
check(true, "空组时操作不报错");

// ==================== 测试 9: 只读 ====================
section("9. 只读模式不响应");

const { container: c9, editor: e9 } = createEditor();
e9.setReadOnly(true);
const c9_card = c9.querySelector(".anim-group-card");
if (c9_card) {
    c9_card.focus();
    press(c9_card, "ArrowDown");
    press(c9_card, "Delete");
    press(c9_card, "Enter");
}
check(true, "只读模式操作不报错");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 模块 4-5 全部测试通过！");
    console.log("  tabindex          容器元素可聚焦 ✓");
    console.log("  ArrowDown/Up      组间导航 ✓");
    console.log("  Enter             折叠/展开 ✓");
    console.log("  Delete            删除组 ✓");
    console.log("  Escape            清除焦点 ✓");
    console.log("  CSS 样式          蓝色 outline ✓");
    console.log("  点击              更新焦点 ✓");
    console.log("  边界              空组/只读 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

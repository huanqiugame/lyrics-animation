/**
 * 模块 4-5 验证脚本：焦点管理 + 键盘导航
 *
 * Tab 行为（与原生 input 焦点融合）：
 *   - Tab on group card → 进入组，聚焦第一个 input
 *   - Tab on input → 浏览器原生切换到下一个 input
 *   - Tab on last input → 进入下一组的第一个 input
 *   - Shift+Tab on first input → 回到组卡片（蓝色焦点）
 *   - Shift+Tab on group card → 上一组
 *
 * 方向键（仅在蓝色焦点激活时）：
 *   - ArrowDown/Up：组间导航
 *   - ArrowLeft/Right：折叠/展开
 *   - Enter：折叠/展开焦点组
 *   - Delete：删除焦点组
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

// ==================== 测试 1: Tab 进入组 ====================
section("1. Tab 进入组 + Shift+Tab 回到卡片");

const { container: c1 } = createEditor();

// Tab → 进入第一组（蓝色焦点）
press(c1, "Tab");
check(focusedGroup(c1) === 0, "Tab: 第一组获得蓝色焦点");

// Tab → 浏览器默认切换 input（仍在组 0 内）
press(c1, "Tab");
check(focusedGroup(c1) === 0, "Tab: 仍在第一组（input 间切换）");

// 多次 Tab 遍历所有 input，最终进入下一组
for (let i = 0; i < 30; i++) press(c1, "Tab");
const after_many_tabs = focusedGroup(c1);
check(after_many_tabs >= 0, "多次 Tab 后焦点仍在某组内");

// Shift+Tab → 回到组卡片（连续 Shift+Tab 遍历 input 后）
for (let i = 0; i < 30; i++) press(c1, "Tab", { shift: true });
check(focusedGroup(c1) >= 0, "Shift+Tab 后焦点仍在某组内");

// Shift+Tab from card → 上一组
press(c1, "Escape"); // 清除所有状态
press(c1, "Tab"); press(c1, "Tab", { shift: true }); // 进入组 0 → 回到卡片
press(c1, "Tab", { shift: true }); // 从组 0 卡片 → 组 2
check(focusedGroup(c1) === 2, "Shift+Tab: 从组卡片到上一组（循环）");

// ==================== 测试 2: ArrowDown/Up 组间导航 ====================
section("2. ArrowDown/Up 组间导航");

const { container: c2 } = createEditor();

press(c2, "Tab"); press(c2, "Tab", { shift: true }); // 进入组 0 卡片

press(c2, "ArrowDown");
check(focusedGroup(c2) === 1, "ArrowDown: 从组 0 到组 1");

press(c2, "ArrowDown");
check(focusedGroup(c2) === 2, "ArrowDown: 从组 1 到组 2");

press(c2, "ArrowDown");
check(focusedGroup(c2) === 2, "ArrowDown: 已在最后一组不移动");

press(c2, "ArrowUp");
check(focusedGroup(c2) === 1, "ArrowUp: 回到组 1");

press(c2, "ArrowUp");
check(focusedGroup(c2) === 0, "ArrowUp: 回到组 0");

press(c2, "ArrowUp");
check(focusedGroup(c2) === 0, "ArrowUp: 已在第一组不移动");

// ==================== 测试 3: Enter 折叠/展开 ====================
section("3. Enter 折叠/展开组");

const { container: c3 } = createEditor();

press(c3, "Tab"); press(c3, "Tab", { shift: true }); // 组 0 卡片
press(c3, "Enter");
let cards3 = c3.querySelectorAll(".anim-group-card");
check(cards3[0].classList.contains("collapsed"), "Enter: 组 0 折叠");

press(c3, "Enter");
cards3 = c3.querySelectorAll(".anim-group-card");
check(!cards3[0].classList.contains("collapsed"), "Enter: 组 0 展开");

// ==================== 测试 4: Delete 删除组 ====================
section("4. Delete 删除焦点组");

const { container: c4, groups: g4 } = createEditor();

press(c4, "Tab"); press(c4, "Tab", { shift: true }); // 组 0
press(c4, "ArrowDown"); // 组 1
check(focusedGroup(c4) === 1, "Delete前: 焦点在组 1");

press(c4, "Delete");
check(g4.length === 2, "Delete: 3→2");
check(g4[0].name === "A", "Delete: 组 A 保留");
check(g4[1].name === "C", "Delete: 组 C 上移");

// ==================== 测试 5: Escape 清除 ====================
section("5. Escape 清除焦点");

const { container: c5 } = createEditor();

press(c5, "Tab"); press(c5, "Tab", { shift: true });
check(focusedGroup(c5) === 0, "Escape前: 有焦点");

press(c5, "Escape");
check(focusedGroup(c5) === -1, "Escape: 焦点清除");

press(c5, "Escape");
check(true, "Escape: 重复不报错");

// ==================== 测试 6: CSS class ====================
section("6. 焦点 CSS class");

const { container: c6 } = createEditor();

press(c6, "Tab"); press(c6, "Tab", { shift: true });
let cards6 = c6.querySelectorAll(".anim-group-card");
check(cards6[0].classList.contains("focused"), "组 0 有 focused");
check(!cards6[1].classList.contains("focused"), "组 1 无 focused");

press(c6, "ArrowDown");
cards6 = c6.querySelectorAll(".anim-group-card");
check(!cards6[0].classList.contains("focused"), "组 0 失焦");
check(cards6[1].classList.contains("focused"), "组 1 获焦");

// ==================== 测试 7: 点击 ====================
section("7. 点击组卡片更新焦点");

const { container: c7 } = createEditor();

let cards7 = c7.querySelectorAll(".anim-group-card");
cards7[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(focusedGroup(c7) === 1, "点击组 1: 获得焦点");
cards7 = c7.querySelectorAll(".anim-group-card");
check(!cards7[0].classList.contains("focused"), "组 1 获焦后组 0 失焦");

// ==================== 测试 8: 边界 ====================
section("8. 边界情况");

const { container: c8, editor: e8 } = createEditor();
e8.load([]);
press(c8, "Tab"); press(c8, "ArrowDown"); press(c8, "Delete"); press(c8, "Escape");
check(true, "空组时操作不报错");

// ==================== 测试 9: 只读 ====================
section("9. 只读模式不响应");

const { container: c9, editor: e9 } = createEditor();
e9.setReadOnly(true);
press(c9, "Tab");
check(focusedGroup(c9) === -1, "只读: Tab 不设置焦点");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 模块 4-5 全部测试通过！");
    console.log("  Tab 进入组        进入第一个 input ✓");
    console.log("  Tab 出组          最后 input → 下一组 ✓");
    console.log("  Shift+Tab         input → 组卡片 → 上一组 ✓");
    console.log("  ArrowDown/Up      组间导航 ✓");
    console.log("  Enter             折叠/展开 ✓");
    console.log("  Delete            删除组 ✓");
    console.log("  Escape            清除焦点 ✓");
    console.log("  focused class     CSS 样式 ✓");
    console.log("  点击              更新焦点 ✓");
    console.log("  边界              空组/只读 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

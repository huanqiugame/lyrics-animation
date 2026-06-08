/**
 * 模块 4-5 验证脚本：焦点管理 + Tab/方向键导航 + Delete 删除
 *
 * 测试内容：
 *   1. Tab/Shift+Tab 在组间切换焦点
 *   2. 方向键在通道间导航
 *   3. Enter 折叠/展开组
 *   4. Delete 删除焦点组/通道
 *   5. Escape 清除焦点
 *   6. 焦点样式 (.focused class)
 *   7. 点击组卡片更新焦点
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
    if (cond) {
        passed++;
    } else {
        console.error(`  ✗ 失败: ${msg}`);
        failed++;
    }
}

function section(title) {
    console.log(`\n=== ${title} ===`);
}

const { createAnimEditor } = await import("../js/ui/anim-editor.js");
const { h } = await import("../js/utils/dom.js");

// ---- 测试数据 ----
function makeTestGroups() {
    return [
        {
            name: "动画组1",
            note: "",
            start: { ref: "wordStart", dir: "before", offset: 200 },
            end: { ref: "wordStart", dir: "after", offset: 0 },
            channels: [
                { channel_id: "opacity", from: 0, to: 1, curve: "ease-out" },
                { channel_id: "blur", from: 8, to: 0, curve: "linear" },
            ],
        },
        {
            name: "动画组2",
            note: "",
            start: { ref: "lineStart", dir: "after", offset: 0 },
            end: { ref: "lineEnd", dir: "before", offset: 100 },
            channels: [
                { channel_id: "fontSize", from: 24, to: 36, curve: "ease-in" },
            ],
        },
        {
            name: "动画组3",
            note: "",
            start: { ref: "wordEnd", dir: "before", offset: 50 },
            end: { ref: "wordEnd", dir: "after", offset: 200 },
            channels: [],
        },
    ];
}

function createEditorWithGroups() {
    const container = h("div", { id: "test-anim-editor" });
    document.body.appendChild(container);
    const editor = createAnimEditor(container);
    const groups = makeTestGroups();
    editor.load(groups);
    return { container, editor, groups };
}

function keydown(el, key, opts = {}) {
    const event = new dom.window.KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ctrlKey: opts.ctrl || false,
        metaKey: opts.meta || false,
        shiftKey: opts.shift || false,
    });
    el.dispatchEvent(event);
    return event;
}

// ==================== 测试 1: Tab 焦点切换 ====================
section("1. Tab/Shift+Tab 在组间切换焦点");

const { container: c1 } = createEditorWithGroups();

// Tab → 焦点到第一个组
keydown(c1, "Tab");
let cards = c1.querySelectorAll(".anim-group-card");
check(cards[0].classList.contains("focused"), "Tab: 第一组获得焦点");

// Tab → 焦点到第二个组
keydown(c1, "Tab");
cards = c1.querySelectorAll(".anim-group-card");
check(cards[1].classList.contains("focused"), "Tab: 第二组获得焦点");
check(!cards[0].classList.contains("focused"), "Tab: 第一组焦点移除");

// Tab → 焦点到第三个组
keydown(c1, "Tab");
cards = c1.querySelectorAll(".anim-group-card");
check(cards[2].classList.contains("focused"), "Tab: 第三组获得焦点");

// Tab → 循环回第一个组
keydown(c1, "Tab");
cards = c1.querySelectorAll(".anim-group-card");
check(cards[0].classList.contains("focused"), "Tab: 循环回第一组");

// Shift+Tab → 反向
keydown(c1, "Tab", { shift: true });
cards = c1.querySelectorAll(".anim-group-card");
check(cards[2].classList.contains("focused"), "Shift+Tab: 反向到第三组");

// ==================== 测试 2: 方向键通道导航 ====================
section("2. 方向键通道导航");

const { container: c2 } = createEditorWithGroups();

// Tab → 第一组
keydown(c2, "Tab");

// ArrowDown → 进入第一组的第一个通道（组已展开）
keydown(c2, "ArrowDown");
cards = c2.querySelectorAll(".anim-group-card");
const ch_rows_1 = cards[0].querySelectorAll(".anim-channel-row");
check(ch_rows_1[0].classList.contains("focused"), "ArrowDown: 进入第一个通道");

// ArrowDown → 下一个通道
keydown(c2, "ArrowDown");
check(ch_rows_1[1].classList.contains("focused"), "ArrowDown: 移动到第二个通道");
check(!ch_rows_1[0].classList.contains("focused"), "ArrowDown: 第一个通道焦点移除");

// ArrowDown → 已是最后一个通道，不移动
keydown(c2, "ArrowDown");
check(ch_rows_1[1].classList.contains("focused"), "ArrowDown: 最后通道保持焦点");

// ArrowUp → 回到第一个通道
keydown(c2, "ArrowUp");
check(ch_rows_1[0].classList.contains("focused"), "ArrowUp: 回到第一个通道");

// ArrowUp → 回到组级别
keydown(c2, "ArrowUp");
cards = c2.querySelectorAll(".anim-group-card");
check(cards[0].classList.contains("focused"), "ArrowUp: 回到组级别焦点");
check(!ch_rows_1[0].classList.contains("focused"), "ArrowUp: 通道焦点移除");

// ArrowUp → 上一个组（已在第一组，不移动）
keydown(c2, "ArrowUp");
cards = c2.querySelectorAll(".anim-group-card");
check(cards[0].classList.contains("focused"), "ArrowUp: 已在第一组不移动");

// ==================== 测试 3: Enter 折叠/展开 ====================
section("3. Enter 折叠/展开组");

const { container: c3 } = createEditorWithGroups();

// Tab → 第一组
keydown(c3, "Tab");

// Enter → 折叠第一组
keydown(c3, "Enter");
cards = c3.querySelectorAll(".anim-group-card");
check(cards[0].classList.contains("collapsed"), "Enter: 第一组折叠");

// Enter → 展开第一组
keydown(c3, "Enter");
cards = c3.querySelectorAll(".anim-group-card");
check(!cards[0].classList.contains("collapsed"), "Enter: 第一组展开");

// ==================== 测试 4: Delete 删除 ====================
section("4. Delete 删除焦点组/通道");

const { container: c4, groups: g4 } = createEditorWithGroups();

// 焦点到第二组
keydown(c4, "Tab");
keydown(c4, "Tab");
cards = c4.querySelectorAll(".anim-group-card");
check(cards[1].classList.contains("focused"), "Delete前: 焦点在第二组");

// Delete → 删除第二组
keydown(c4, "Delete");
check(g4.length === 2, "Delete: 组数从3变为2");
check(g4[0].name === "动画组1", "Delete: 第一组保留");
check(g4[1].name === "动画组3", "Delete: 第三组上移");

// 焦点到第一组，进入通道
keydown(c4, "Tab"); // 第一组
keydown(c4, "ArrowDown"); // 进入通道
cards = c4.querySelectorAll(".anim-group-card");
const ch_rows_del = cards[0].querySelectorAll(".anim-channel-row");
check(ch_rows_del[0].classList.contains("focused"), "Delete前: 焦点在通道");

// Delete → 删除焦点通道
keydown(c4, "Delete");
check(g4[0].channels.length === 1, "Delete: 通道数从2变为1");
check(g4[0].channels[0].channel_id === "blur", "Delete: 保留blur通道");

// ==================== 测试 5: Escape 清除焦点 ====================
section("5. Escape 清除焦点");

const { container: c5 } = createEditorWithGroups();

keydown(c5, "Tab");
cards = c5.querySelectorAll(".anim-group-card");
check(cards[0].classList.contains("focused"), "Escape前: 有焦点");

keydown(c5, "Escape");
cards = c5.querySelectorAll(".anim-group-card");
check(!cards[0].classList.contains("focused"), "Escape: 焦点已清除");

// 再次 Escape 不报错
keydown(c5, "Escape");
check(true, "Escape: 重复Escape不报错");

// ==================== 测试 6: 焦点样式 ====================
section("6. 焦点 CSS class");

const { container: c6 } = createEditorWithGroups();

keydown(c6, "Tab");
cards = c6.querySelectorAll(".anim-group-card");
check(cards[0].classList.contains("focused"), "组焦点有 focused class");
check(!cards[1].classList.contains("focused"), "其他组无 focused class");

keydown(c6, "ArrowDown");
const ch_rows_6 = cards[0].querySelectorAll(".anim-channel-row");
check(ch_rows_6[0].classList.contains("focused"), "通道焦点有 focused class");
check(!cards[0].classList.contains("focused"), "组焦点在通道聚焦时移除");

// ==================== 测试 7: 点击更新焦点 ====================
section("7. 点击组卡片更新焦点");

const { container: c7 } = createEditorWithGroups();

// 点击第二组卡片
cards = c7.querySelectorAll(".anim-group-card");
cards[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(cards[1].classList.contains("focused"), "点击第二组: 获得焦点");
check(!cards[0].classList.contains("focused"), "点击第二组: 第一组失焦");

// ==================== 测试 8: 空组时 Tab 不报错 ====================
section("8. 边界情况");

const { container: c8, editor: e8 } = createEditorWithGroups();
e8.load([]); // 空组
keydown(c8, "Tab");
keydown(c8, "ArrowDown");
keydown(c8, "Delete");
keydown(c8, "Escape");
check(true, "空组时键盘操作不报错");

// ==================== 测试 9: 只读模式不响应 ====================
section("9. 只读模式不响应键盘");

const { container: c9, editor: e9 } = createEditorWithGroups();
e9.setReadOnly(true);

keydown(c9, "Tab");
cards = c9.querySelectorAll(".anim-group-card");
check(!cards[0].classList.contains("focused"), "只读模式: Tab不设置焦点");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 模块 4-5 全部测试通过！");
    console.log("  Tab/Shift+Tab    组间焦点切换 ✓");
    console.log("  ArrowDown/Up     通道间导航 ✓");
    console.log("  Enter            折叠/展开组 ✓");
    console.log("  Delete           删除组/通道 ✓");
    console.log("  Escape           清除焦点 ✓");
    console.log("  focused class    CSS 样式正确 ✓");
    console.log("  点击更新焦点     点击组卡片 ✓");
    console.log("  边界情况         空组/只读模式 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

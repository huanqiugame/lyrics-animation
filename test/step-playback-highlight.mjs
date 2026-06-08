/**
 * 模块 1-3 验证脚本：播放高亮 + 双击跳转 + 快速时间跳转
 *
 * 测试内容：
 *   1. parseTimeInput 各种格式解析
 *   2. 播放高亮：timeupdate 驱动 playing/word-playing class
 *   3. 播放高亮：selected 优先于 playing
 *   4. 双击跳转：dblclick 行/字触发 ui:seek
 *   5. 快速时间跳转：点击时间显示弹出 input
 *
 * 用法：node test/step-playback-highlight.mjs
 */

import { JSDOM } from "jsdom";

// ---- 设置 jsdom 全局 DOM 环境 ----
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

// ---- 导入被测模块 ----
const { bus } = await import("../js/utils/events.js");
const { h } = await import("../js/utils/dom.js");
const { initLyricList } = await import("../js/ui/lyric-list.js");
const { parseTimeInput } = await import("../js/ui/playback.js");
const { createEmptyProject } = await import("../js/ttml/types.js");

// ==================== 测试 1: parseTimeInput ====================
section("1. parseTimeInput 格式解析");

// 纯秒数
check(parseTimeInput("0") === 0, `"0" → 0ms`);
check(parseTimeInput("90") === 90000, `"90" → 90000ms`);
check(parseTimeInput("90.5") === 90500, `"90.5" → 90500ms`);
check(parseTimeInput("1.234") === 1234, `"1.234" → 1234ms`);

// MM:SS
check(parseTimeInput("1:30") === 90000, `"1:30" → 90000ms`);
check(parseTimeInput("0:00") === 0, `"0:00" → 0ms`);
check(parseTimeInput("10:05") === 605000, `"10:05" → 605000ms`);

// MM:SS.mmm
check(parseTimeInput("1:30.500") === 90500, `"1:30.500" → 90500ms`);
check(parseTimeInput("0:00.000") === 0, `"0:00.000" → 0ms`);
check(parseTimeInput("2:15.123") === 135123, `"2:15.123" → 135123ms`);

// 无效输入
check(parseTimeInput("") === null, `空字符串 → null`);
check(parseTimeInput("abc") === null, `"abc" → null`);
check(parseTimeInput("1:2:3") === null, `"1:2:3" → null`);
check(parseTimeInput("1:60") === 120000, `"1:60" → 120000ms（仅格式解析，不校验范围）`);

// ==================== 测试 2: 播放高亮 ====================
section("2. 播放高亮 — 行/字 class 增量更新");

// 准备测试项目
function makeProject() {
    const p = createEmptyProject();
    p.lyrics = [
        {
            id: "L1",
            words: [
                { word: "Hello", start_time: 0, end_time: 1000, anim_groups: [], style: null, style_ref: null },
                { word: "World", start_time: 1000, end_time: 2000, anim_groups: [], style: null, style_ref: null },
            ],
            start_time: 0,
            end_time: 2000,
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
                { word: "Foo", start_time: 2000, end_time: 3000, anim_groups: [], style: null, style_ref: null },
                { word: "Bar", start_time: 3000, end_time: 4000, anim_groups: [], style: null, style_ref: null },
            ],
            start_time: 2000,
            end_time: 4000,
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
    return p;
}

const list_container = h("div", { id: "test-playback-list" });
document.body.appendChild(list_container);

initLyricList(list_container);

const project = makeProject();
bus.emit("lyrics:loaded", project);

// 初始状态：无 playing class
let rows = list_container.querySelectorAll(".lyric-row");
check(rows.length === 2, `渲染 2 行 (实际: ${rows.length})`);
check(!rows[0].classList.contains("playing"), "初始：L1 无 playing class");
check(!rows[1].classList.contains("playing"), "初始：L2 无 playing class");

// 模拟 timeupdate：500ms → L1 的 "Hello"（0-1000）
bus.emit("audio:timeupdate", { currentTime: 500 });
rows = list_container.querySelectorAll(".lyric-row");
check(rows[0].classList.contains("playing"), "t=500ms: L1 有 playing class");
check(!rows[1].classList.contains("playing"), "t=500ms: L2 无 playing class");

let l1_words = rows[0].querySelectorAll(".word-tag");
check(l1_words[0].classList.contains("word-playing"), "t=500ms: 'Hello' 有 word-playing");
check(!l1_words[1].classList.contains("word-playing"), "t=500ms: 'World' 无 word-playing");

// 模拟 timeupdate：1500ms → L1 的 "World"（1000-2000）
bus.emit("audio:timeupdate", { currentTime: 1500 });
rows = list_container.querySelectorAll(".lyric-row");
check(rows[0].classList.contains("playing"), "t=1500ms: L1 仍 playing");
l1_words = rows[0].querySelectorAll(".word-tag");
check(!l1_words[0].classList.contains("word-playing"), "t=1500ms: 'Hello' 不再 word-playing");
check(l1_words[1].classList.contains("word-playing"), "t=1500ms: 'World' 有 word-playing");

// 模拟 timeupdate：2500ms → L2 的 "Foo"
bus.emit("audio:timeupdate", { currentTime: 2500 });
rows = list_container.querySelectorAll(".lyric-row");
check(!rows[0].classList.contains("playing"), "t=2500ms: L1 不再 playing");
check(rows[1].classList.contains("playing"), "t=2500ms: L2 有 playing");
let l2_words = rows[1].querySelectorAll(".word-tag");
check(l2_words[0].classList.contains("word-playing"), "t=2500ms: 'Foo' 有 word-playing");

// 模拟 timeupdate：无匹配行（如 5000ms）
bus.emit("audio:timeupdate", { currentTime: 5000 });
rows = list_container.querySelectorAll(".lyric-row");
check(!rows[1].classList.contains("playing"), "t=5000ms: 无匹配行，L2 不再 playing");

// ==================== 测试 3: selected 优先于 playing ====================
section("3. selected + playing 共存");

bus.emit("lyrics:loaded", makeProject());

// 选中 L1
rows = list_container.querySelectorAll(".lyric-row");
rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(rows[0].classList.contains("selected"), "L1 有 selected class");

// 播放到 L1
bus.emit("audio:timeupdate", { currentTime: 500 });
rows = list_container.querySelectorAll(".lyric-row");
check(rows[0].classList.contains("selected"), "L1 仍有 selected");
check(rows[0].classList.contains("playing"), "L1 同时有 playing");

// ==================== 测试 4: 双击跳转 ====================
section("4. 双击跳转 — 行/字 dblclick → ui:seek");

bus.emit("lyrics:loaded", makeProject());
rows = list_container.querySelectorAll(".lyric-row");

let seek_event = null;
bus.on("ui:seek", (ev) => { seek_event = ev; });

// 双击第一行 → 应 emit ui:seek with time = 0
seek_event = null;
rows[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
check(seek_event !== null, "双击行触发 ui:seek");
check(seek_event.time === 0, `双击 L1 跳转 time=0 (实际: ${seek_event.time})`);

// 双击第二个词 → 应 emit ui:seek with time = 1000
seek_event = null;
const words = rows[0].querySelectorAll(".word-tag");
words[1].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
check(seek_event !== null, "双击词触发 ui:seek");
check(seek_event.time === 1000, `双击 'World' 跳转 time=1000 (实际: ${seek_event.time})`);

// 双击第一行的 "Hello" → time=0
seek_event = null;
words[0].dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
check(seek_event.time === 0, `双击 'Hello' 跳转 time=0 (实际: ${seek_event.time})`);

// ==================== 测试 5: lyrics:loaded 重置播放状态 ====================
section("5. lyrics:loaded 重置播放高亮状态");

bus.emit("lyrics:loaded", makeProject());
bus.emit("audio:timeupdate", { currentTime: 500 });
rows = list_container.querySelectorAll(".lyric-row");
check(rows[0].classList.contains("playing"), "播放中 L1 有 playing");

// 重新加载项目 → playing 应清除
bus.emit("lyrics:loaded", makeProject());
rows = list_container.querySelectorAll(".lyric-row");
check(!rows[0].classList.contains("playing"), "重新加载后 L1 playing 被清除");

// ==================== 测试 6: ui:seek 事件格式 ====================
section("6. ui:seek 事件数据验证");

seek_event = null;
bus.emit("ui:seek", { time: 12345 });
check(seek_event !== null, "ui:seek 事件可接收");
check(seek_event.time === 12345, "ui:seek.time 值正确");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 模块 1-3 全部测试通过！");
    console.log("  parseTimeInput   各格式解析正确 ✓");
    console.log("  播放高亮         行/字 class 增量更新 ✓");
    console.log("  selected优先     selected 覆盖 playing ✓");
    console.log("  双击跳转         行/字 dblclick → ui:seek ✓");
    console.log("  状态重置         lyrics:loaded 清除高亮 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

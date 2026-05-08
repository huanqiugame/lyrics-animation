/**
 * 逐词点击选择 → 字动画组编辑器 验证脚本
 * 测试 lyric-list 中逐词点击选择/取消事件
 * 测试 param-panel 响应选中词切换到字动画组编辑模式
 *
 * 用法：node test/step-word-selection.mjs
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
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.EventTarget = dom.window.EventTarget;

console.log("✓ jsdom DOM 环境就绪\n");

let passed = 0;
let failed = 0;

function check(cond, msg) {
    if (cond) { passed++; }
    else { console.error(`  ✗ 失败: ${msg}`); failed++; }
}

function section(title) {
    console.log(`\n=== ${title} ===`);
}

// ---- 导入被测模块 ----
const { bus } = await import("../js/utils/events.js");
const { h, clear } = await import("../js/utils/dom.js");
const { initLyricList } = await import("../js/ui/lyric-list.js");
const { initParamPanel } = await import("../js/ui/param-panel.js");
const { createEmptyProject } = await import("../js/ttml/types.js");

// ==================== 准备工作：创建测试项目 ====================

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
                { word: "Test", start_time: 2000, end_time: 3000, anim_groups: [], style: null, style_ref: null },
                { word: "Word2", start_time: 3000, end_time: 4000, anim_groups: [], style: null, style_ref: null },
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

// ==================== 测试 1: 逐词点击选择 ====================
section("1. 逐词点击选择");

const list_container = h("div", { id: "test-word-list" });
document.body.appendChild(list_container);

initLyricList(list_container);

const project1 = makeProject();
bus.emit("lyrics:loaded", project1);

const rows = list_container.querySelectorAll(".lyric-row");
check(rows.length === 2, "歌词行数 = 2");

// 找到第一个行的词汇 span
const row0_words = rows[0].querySelectorAll(".word-tag");
check(row0_words.length === 2, "L1 有 2 个词汇 (实际: " + row0_words.length + ")");
check(row0_words[0].textContent === "Hello", "词汇 0 = Hello");
check(row0_words[1].textContent === "World", "词汇 1 = World");

const row1_words = rows[1].querySelectorAll(".word-tag");
check(row1_words.length === 2, "L2 有 2 个词汇 (实际: " + row1_words.length + ")");

// 点击第一个词 "Hello"
let select_word_event = null;
bus.on("ui:selectWord", (ev) => { select_word_event = ev; });

let select_line_event = null;
bus.on("ui:selectLine", (ev) => { select_line_event = ev; });

row0_words[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));

check(select_line_event !== null, "点击词后触发 ui:selectLine（选中所在行）");
if (select_line_event) {
    check(select_line_event.lineId === "L1", "selectLine lineId = L1");
}

check(select_word_event !== null, "点击词后触发 ui:selectWord");
if (select_word_event) {
    check(select_word_event.lineId === "L1", "selectWord lineId = L1");
    check(select_word_event.wordIndex === 0, "selectWord wordIndex = 0 (实际: " + select_word_event.wordIndex + ")");
    check(select_word_event.word.word === "Hello", "selectWord word.word = Hello");
    check(select_word_event.line !== null, "selectWord 携带 line 对象");
}

// 行和词都应该有选中样式
check(rows[0].classList.contains("selected"), "行 L1 有 selected class");
check(row0_words[0].classList.contains("word-selected"), "Hello 有 word-selected class");

// ==================== 测试 2: 同词点击取消 ====================
section("2. 同词点击取消");

select_word_event = null;
select_line_event = null;

// 再次点击 Hello → 取消选择
row0_words[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));

check(select_word_event !== null, "同词再次点击触发 ui:selectWord");
if (select_word_event) {
    check(select_word_event.lineId === null, "取消选择时 lineId = null");
    check(select_word_event.word === null, "取消选择时 word = null");
    check(select_word_event.wordIndex === null, "取消选择时 wordIndex = null");
}

// 已经选中的行不应该取消选中（只取消词）
check(rows[0].classList.contains("selected"), "取消词选中后行仍为选中状态");
check(!row0_words[0].classList.contains("word-selected"), "取消选择后 word-selected class 移除");

// ==================== 测试 3: 同行切换词汇 ====================
section("3. 同行切换词汇");

select_word_event = null;
select_line_event = null;

// 先选中 Hello
row0_words[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(select_word_event.wordIndex === 0, "选中 Hello");

// 再点击 World（同一行）
select_word_event = null;
select_line_event = null;

row0_words[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));

check(select_word_event !== null, "点击同行的另一个词触发 ui:selectWord");
if (select_word_event) {
    check(select_word_event.wordIndex === 1, "切换后 wordIndex = 1");
    check(select_word_event.word.word === "World", "切换后 word = World");
}

// selectLine 不应再次触发（同一行）
check(select_line_event === null, "同行切换词不触发 ui:selectLine");

// 视觉样式检查
check(!row0_words[0].classList.contains("word-selected"), "Hello 的 word-selected 已移除");
check(row0_words[1].classList.contains("word-selected"), "World 有 word-selected class");

// ==================== 测试 4: 跨行选择词汇 ====================
section("4. 跨行选择词汇");

select_word_event = null;
select_line_event = null;

// 点击 L2 的第一个词 "Test"
row1_words[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));

// 应先触发行切换
check(select_line_event !== null, "跨行选择词触发 ui:selectLine");
if (select_line_event) {
    check(select_line_event.lineId === "L2", "行切换为 L2");
}

// 再触发词选择
check(select_word_event !== null, "跨行选择词触发 ui:selectWord");
if (select_word_event) {
    check(select_word_event.lineId === "L2", "selectWord lineId = L2");
    check(select_word_event.wordIndex === 0, "selectWord wordIndex = 0");
    check(select_word_event.word.word === "Test", "selectWord word = Test");
}

// 行/词视觉样式
check(rows[1].classList.contains("selected"), "L2 行有 selected class");
check(!rows[0].classList.contains("selected"), "L1 行 selected 已移除");
check(row1_words[0].classList.contains("word-selected"), "Test 有 word-selected class");
check(!row0_words[1].classList.contains("word-selected"), "World 的 word-selected 已移除");

// ==================== 测试 5: 点击行空白区域清除词选中 ====================
section("5. 点击行空白区域清除词选中");

select_word_event = null;

// 点击 L2 行空白区域（time 区域）
const row_time = rows[1].querySelector(".row-time");
row_time.dispatchEvent(new MouseEvent("click", { bubbles: true }));

// 行本身仍然选中（切换选中逻辑触发行取消）
// 但词选中应被清除
check(!row1_words[0].classList.contains("word-selected"), "点击行空白后 word-selected 移除");

// ==================== 测试 6: 参数面板响应词选中 ====================
section("6. 参数面板响应词选中");

const panel_container = h("div", { id: "test-word-panel" });
document.body.appendChild(panel_container);

initParamPanel(panel_container);

const project6 = makeProject();
// 为 L1 的 Hello 词添加动画组
project6.lyrics[0].words[0].anim_groups = [
    {
        start: { ref: "wordStart", dir: "before", offset: 100 },
        end: { ref: "wordEnd", dir: "after", offset: 0 },
        channels: [
            { channel_id: "opacity", from: 0, to: 1, curve: "ease-out" },
        ],
    },
];
bus.emit("lyrics:loaded", project6);

// 验证初始标题为"全局字动画组"（现在只有 2 个区块）
const word_title = panel_container.querySelectorAll(".param-section-title")[1];
check(word_title.textContent === "全局字动画组", `初始标题 = "全局字动画组" (实际: "${word_title.textContent}")`);

// 选中 Hello 词 → 标题应切换
bus.emit("ui:selectWord", { lineId: "L1", line: project6.lyrics[0], wordIndex: 0, word: project6.lyrics[0].words[0] });
check(word_title.textContent === "字动画组 [Hello]", `选中 Hello 后标题 = "字动画组 [Hello]" (实际: "${word_title.textContent}")`);

// 验证字动画组编辑器中加载了 Hello 的自定义动画组（1 个）
const word_section = panel_container.querySelectorAll(".param-section")[1];
const word_group_cards = word_section.querySelectorAll(".anim-group-card");
check(word_group_cards.length === 1, "Hello 有 1 个自定义动画组 (实际: " + word_group_cards.length + ")");

// 选中 World（anim_groups=[] 空数组，显示空，不回退到全局）
bus.emit("ui:selectWord", { lineId: "L1", line: project6.lyrics[0], wordIndex: 1, word: project6.lyrics[0].words[1] });
check(word_title.textContent === "字动画组 [World]", `选中 World 后标题 = "字动画组 [World]" (实际: "${word_title.textContent}")`);
const world_group_cards = word_section.querySelectorAll(".anim-group-card");
check(world_group_cards.length === 0, "World 有空数组，显示 0 个动画组 (实际: " + world_group_cards.length + ")");

// 取消选择 → 恢复全局
bus.emit("ui:selectWord", { lineId: null, line: null, wordIndex: null, word: null });
check(word_title.textContent === "全局字动画组", `取消选择后标题恢复 (实际: "${word_title.textContent}")`);

// ==================== 测试 7: 字动画组编辑保存到词 ====================
section("7. 字动画组编辑保存到词");

let lyrics_modified_data = null;
bus.on("lyrics:modified", (data) => { lyrics_modified_data = data; });

// 选中 Hello 词
const hello_word = project6.lyrics[0].words[0];
bus.emit("ui:selectWord", { lineId: "L1", line: project6.lyrics[0], wordIndex: 0, word: hello_word });

// 通过"添加动画组"按钮触发编辑器变更
const add_btn = panel_container.querySelectorAll(".btn-add-group")[1]; // 第二个是字动画组的
check(add_btn !== null, "存在字动画组「添加动画组」按钮");

if (add_btn) {
    lyrics_modified_data = null;
    add_btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

// 验证 Hello 的 anim_groups 已增加
check(hello_word.anim_groups.length === 2, `Hello 动画组数 = 2 (实际: ${hello_word.anim_groups.length})`);

// 验证 lyrics:modified 事件已触发
check(lyrics_modified_data !== null, "添加动画组后触发了 lyrics:modified");
if (lyrics_modified_data) {
    check(lyrics_modified_data.lyrics[0].words[0].anim_groups.length === 2, "lyrics:modified 携带更新后的词数据");
}

// ==================== 测试 8: lyrics:loaded + lyrics:modified 重置/保留 ====================
section("8. lyrics:loaded 重置 + lyrics:modified 保留");

// 选中 Hello 词
bus.emit("ui:selectWord", { lineId: "L1", line: project6.lyrics[0], wordIndex: 0, word: hello_word });
check(word_title.textContent === "字动画组 [Hello]", "选中后标题更新");

// 加载新项目 → 应重置
const project8 = makeProject();
lyrics_modified_data = null;
bus.emit("lyrics:loaded", project8);
check(word_title.textContent === "全局字动画组", "加载新项目后标题恢复为全局");

// 重新选中 Hello 词，编辑后触发 lyrics:modified，验证保留
bus.emit("ui:selectWord", { lineId: "L1", line: project8.lyrics[0], wordIndex: 0, word: project8.lyrics[0].words[0] });

// 在 param-panel 中，ui:selectLine 会设置 selected_line，所以选中词前先选中行
bus.emit("ui:selectLine", { lineId: "L1", line: project8.lyrics[0] });
bus.emit("ui:selectWord", { lineId: "L1", line: project8.lyrics[0], wordIndex: 0, word: project8.lyrics[0].words[0] });
check(word_title.textContent === "字动画组 [Hello]", "选中 Hello 后标题更新");

const add_btn2 = panel_container.querySelectorAll(".btn-add-group")[1];
if (add_btn2) {
    lyrics_modified_data = null;
    add_btn2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}
check(project8.lyrics[0].words[0].anim_groups.length === 1, "lyrics:modified 后词动画组被保存");

// ==================== 测试 9: 选中行后选中词，ui:selectLine 清除词 ====================
section("9. ui:selectLine 清除词选中");

bus.emit("ui:selectWord", { lineId: "L1", line: project8.lyrics[0], wordIndex: 0, word: project8.lyrics[0].words[0] });
check(word_title.textContent === "字动画组 [Hello]", "词已选中");

// 发送行选择事件（切换行）→ 应清除词选中
let word_select_cleared = false;
bus.on("ui:selectWord", (ev) => {
    if (ev.word === null) word_select_cleared = true;
});

bus.emit("ui:selectLine", { lineId: "L2", line: project8.lyrics[1] });

check(word_title.textContent === "全局字动画组", "切换行后字标题恢复为全局（词已被清除）");

// ==================== 测试 10: 行选中 + 词选中视觉隔离 ====================
section("10. 行选中 + 词选中视觉隔离");

bus.emit("lyrics:loaded", makeProject());

const row0 = list_container.querySelectorAll(".lyric-row")[0];
const words0 = row0.querySelectorAll(".word-tag");

// 点击词 → 行和词都应选中
words0[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(row0.classList.contains("selected"), "点击词后行 selected");
check(words0[0].classList.contains("word-selected"), "点击词后词 word-selected");

// 点击行空白区域（row-index）→ 词 visual 清除，行被取消
const row_index = row0.querySelector(".row-index");
row_index.dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(!words0[0].classList.contains("word-selected"), "点击行空白后词 visual 清除");

// 重新点击词 → 行和词再次选中
words0[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(row0.classList.contains("selected"), "重新点击词后行 selected");
check(words0[0].classList.contains("word-selected"), "重新点击词后词 word-selected");

// 行和词独立视觉：词有 word-selected 且有 row selected
check(row0.classList.contains("selected") && words0[0].classList.contains("word-selected"),
    "行 selected + 词 word-selected 同时存在");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 逐词选择全部测试通过！");
    console.log("  逐词点击选择     click → ui:selectWord ✓");
    console.log("  同词取消        再次点击 → ui:selectWord null ✓");
    console.log("  同行切换词      切换词不触发 ui:selectLine ✓");
    console.log("  跨行选择词      先选行再选词 ✓");
    console.log("  行空白点击      清除词选中 visual ✓");
    console.log("  词选中标题      字动画组 [词内容] ✓");
    console.log("  词动画组加载    显示词已有的动画组 ✓");
    console.log("  编辑保存到词    lyrics:modified 携带词数据 ✓");
    console.log("  lyrics:loaded   重置词选中 ✓");
    console.log("  ui:selectLine   清除词选中 ✓");
    console.log("  行/词 visual    行 selected + 词 word-selected 独立 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

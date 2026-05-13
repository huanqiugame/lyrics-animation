/**
 * Step 3 验证脚本：行选择 → 动画组编辑联动
 * 测试 lyric-list 的选择/取消事件
 * 测试 param-panel 响应选中行切换动画组编辑模式
 *
 * 用法：node test/step3-line-selection.mjs
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
            anim_groups: [
                { start: { ref: "lineStart", dir: "after", offset: 0 }, end: { ref: "lineEnd", dir: "before", offset: 200 }, channels: [{ channel_id: "opacity", from: 0, to: 1, curve: "ease-out" }] },
            ],
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
            words: [{ word: "Test", start_time: 2000, end_time: 3000, anim_groups: [], style: null, style_ref: null }],
            start_time: 2000,
            end_time: 3000,
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

// ==================== 测试 1: 歌词列表点击选择 ====================
section("1. 歌词列表点击选择 / 取消");

const list_container = h("div", { id: "test-lyric-list" });
document.body.appendChild(list_container);

initLyricList(list_container);

const project1 = makeProject();
bus.emit("lyrics:loaded", project1);

// 检查是否渲染了 2 行
const rows = list_container.querySelectorAll(".lyric-row");
check(rows.length === 2, `歌词行数 = 2 (实际: ${rows.length})`);

// 点击第一行
let select_event = null;
bus.on("ui:selectLine", (ev) => { select_event = ev; });

rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(select_event !== null, "点击行后 ui:selectLine 被触发");
check(select_event.line !== null, "selectLine 携带 line 对象");
check(select_event.lineId === "L1", `携带的 lineId = L1 (实际: ${select_event.lineId})`);
check(select_event.line.anim_groups.length === 1, "携带的 line 包含 anim_groups");

// 选中样式
check(rows[0].classList.contains("selected"), "选中后恢复 selected class");

// 再次点击同一行 → 取消选择
select_event = null;
rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(select_event !== null, "再次点击后 ui:selectLine 再次触发");
check(select_event.line === null, "取消选择时 line = null");
check(select_event.lineId === null, "取消选择时 lineId = null");
check(!rows[0].classList.contains("selected"), "取消选择后 selected class 移除");

// 点击不同行
select_event = null;
rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
check(select_event !== null, "点击第二行触发 selectLine");
check(select_event.lineId === "L2", `第二行 lineId = L2 (实际: ${select_event.lineId})`);
check(!rows[0].classList.contains("selected"), "点击第二行后第一行取消选中");

// ==================== 测试 2: 参数面板选中模式切换 ====================
section("2. 参数面板选中行模式");

const panel_container = h("div", { id: "test-param-panel" });
document.body.appendChild(panel_container);

initParamPanel(panel_container);

const project2 = makeProject();
bus.emit("lyrics:loaded", project2);

// 验证初始状态：全局行动画组
// 现在只有 2 个区块（行/字动画组），行是第一个
const line_title = panel_container.querySelectorAll(".param-section-title")[0].children[0];
check(line_title.textContent === "全局行动画组", `初始标题 = "全局行动画组" (实际: "${line_title.textContent}")`);

// 选中 L1（L1 有 1 个动画组）→ 编辑器显示该行的动画组
bus.emit("ui:selectLine", { lineId: "L1", line: project2.lyrics[0] });
// L1 有 1 个自定义动画组，编辑器应显示这 1 个组（不显示全局组）
// 查询行动画组区块内的卡片（第一个 param-section）
const line_section = panel_container.querySelectorAll(".param-section")[0];
const group_cards_l1 = line_section.querySelectorAll(".anim-group-card");
check(group_cards_l1.length === 1, `L1 有一个动画组 (实际: ${group_cards_l1.length})`);
check(line_title.textContent === "行动画组 [L1]", `选中 L1 后标题 = "行动画组 [L1]" (实际: "${line_title.textContent}")`);

// 选中 L2（L2 无动画组）→ 编辑器显示 0 个组
bus.emit("ui:selectLine", { lineId: "L2", line: project2.lyrics[1] });
const group_cards_l2 = line_section.querySelectorAll(".anim-group-card");
// L2.anim_groups = [] 空数组，编辑器应显示 0 个组（选中时显示行自身的组，不回退到全局）
check(group_cards_l2.length === 0, `L2 无动画组 (实际: ${group_cards_l2.length})`);
check(line_title.textContent === "行动画组 [L2]", `选中 L2 后标题 = "行动画组 [L2]" (实际: "${line_title.textContent}")`);

// 取消选择 → 恢复全局
bus.emit("ui:selectLine", { lineId: null, line: null });
check(line_title.textContent === "全局行动画组", `取消选择后标题恢复 (实际: "${line_title.textContent}")`);

// ==================== 测试 3: 行动画组编辑发射事件 ====================
section("3. 行动画组编辑事件");

let lyrics_modified_data = null;
bus.on("lyrics:modified", (data) => { lyrics_modified_data = data; });

// 选中 L1 后添加动画组 → 应触发 lyrics:modified（非 config:changed）
bus.emit("ui:selectLine", { lineId: "L1", line: project2.lyrics[0] });

// 通过点击"添加动画组"按钮触发编辑器变更
const add_btn = panel_container.querySelector(".btn-add-group");
check(add_btn !== null, "存在「添加动画组」按钮");

if (add_btn) {
    add_btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

// 验证 L1 的 anim_groups 已增加
check(project2.lyrics[0].anim_groups.length === 2, `L1 动画组数 = 2 (实际: ${project2.lyrics[0].anim_groups.length})`);

// 验证 lyrics:modified 事件已触发
check(lyrics_modified_data !== null, "添加动画组后触发了 lyrics:modified");
if (lyrics_modified_data) {
    check(lyrics_modified_data.lyrics[0].anim_groups.length === 2, "lyrics:modified 携带更新后的行数据");
}

// 取消选择后添加动画组 → 应触发 config:changed
let config_changed_data = null;
bus.on("config:changed", (cfg) => { config_changed_data = cfg; });

bus.emit("ui:selectLine", { lineId: null, line: null });
lyrics_modified_data = null;
config_changed_data = null;

const add_btn2 = panel_container.querySelector(".btn-add-group");
if (add_btn2) {
    add_btn2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

check(lyrics_modified_data === null, "取消选择后添加动画组不触发 lyrics:modified");
check(config_changed_data !== null, "取消选择后添加动画组触发 config:changed");
if (config_changed_data) {
    check(Array.isArray(config_changed_data.line_anim_groups), "config:changed 携带 line_anim_groups");
    check(config_changed_data.line_anim_groups.length >= 1, "全局 line_anim_groups 已增加");
}

// ==================== 测试 4: lyrics:loaded 重置选择 ====================
section("4. lyrics:loaded 重置选中状态");

// 选中一个行
bus.emit("ui:selectLine", { lineId: "L1", line: project2.lyrics[0] });
check(line_title.textContent === "行动画组 [L1]", "选中 L1 后标题更新");

// 加载新项目 → 应重置为全局
const project3 = makeProject();
bus.emit("lyrics:loaded", project3);
check(line_title.textContent === "全局行动画组", "加载新项目后标题恢复为全局");
check(panel_container.querySelectorAll(".btn-add-group").length === 2, "新项目后编辑器可正常操作");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 Step 3 全部测试通过！");
    console.log("  歌词列表点击     点击行 → ui:selectLine line ✓");
    console.log("  歌词列表取消     再次点击 → ui:selectLine null ✓");
    console.log("  选中行提示       标题切换 行ID/全局 ✓");
    console.log("  行动画组加载     选中行显示已存动画组 ✓");
    console.log("  编辑保存到行     lyrics:modified 带行数据 ✓");
    console.log("  取消→全局编辑    config:changed ✓");
    console.log("  新项目重置       lyrics:loaded 重置选中 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

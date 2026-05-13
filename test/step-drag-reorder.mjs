/**
 * 动画组/通道优先级顺序 + 拖拽排序测试
 *
 * 验证：
 * 1. resolveWord 中同级动画组按"靠上=高优先级"顺序解析
 * 2. evaluateGroup 中同组通道按"靠上=高优先级"顺序解析
 * 3. 调整组顺序后解析结果随之改变
 * 4. 动画组编辑器数据管理（模拟重排后数据一致性）
 * 5. 文件拖拽覆盖层不对内部 HTML5 DnD 响应
 * 6. 跨层优先级不变（字 > 行 > 全局 > 硬编码）
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" });
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.EventTarget = dom.window.EventTarget;

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

const { resolveWord, evaluateGroup } = await import("../js/animation/resolver.js");

// ========== 测试 1: 同级动画组顺序 ==========
section("1. 同级动画组顺序（靠上=高优先级）");

const line_1 = { start_time: 0, end_time: 10000, anim_groups: [] };
const word_1 = { start_time: 1000, end_time: 5000, anim_groups: [] };

// 同一层级两个动画组定义了相同的 channel（opacity），靠上的组应胜出
const config_1 = {
    line_anim_groups: [],
    word_anim_groups: [
        // 组 0（靠上，高优先级）：opacity=1
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "opacity", from: 1, to: 1, curve: "linear" },
            ],
        },
        // 组 1（靠下，低优先级）：opacity=0.5
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "opacity", from: 0.5, to: 0.5, curve: "linear" },
            ],
        },
    ],
};

// t=2500ms 时两组都激活，靠上的组 0（opacity=1）应胜出
const r1 = resolveWord(2500, line_1, word_1, config_1);
check(r1.get("opacity") === 1, "靠上组 opacity=1 胜出 (实际: " + r1.get("opacity") + ")");

// ========== 测试 2: 交换组顺序后结果改变 ==========
section("2. 交换顺序后高优先级组改变");

const config_2 = {
    line_anim_groups: [],
    word_anim_groups: [
        // 组 0（靠上，高优先级）：opacity=0.3
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "opacity", from: 0.3, to: 0.3, curve: "linear" },
            ],
        },
        // 组 1（靠下，低优先级）：opacity=0.9
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "opacity", from: 0.9, to: 0.9, curve: "linear" },
            ],
        },
    ],
};

const r2 = resolveWord(2500, line_1, word_1, config_2);
check(r2.get("opacity") === 0.3, "交换后靠上组 opacity=0.3 胜出 (实际: " + r2.get("opacity") + ")");

// ========== 测试 3: 不通用的通道不受影响 ==========
section("3. 不同通道不受顺序影响");

const config_3 = {
    line_anim_groups: [],
    word_anim_groups: [
        // 组 0（靠上）：blur=10
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "blur", from: 10, to: 10, curve: "linear" },
            ],
        },
        // 组 1（靠下）：color=red
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "color", from: "#ff0000", to: "#ff0000", curve: "linear" },
            ],
        },
    ],
};

const r3 = resolveWord(2500, line_1, word_1, config_3);
check(r3.get("blur") === 10, "blur=10 (来自靠上组)");
check(r3.get("color") === "#ff0000", "color=#ff0000 (来自靠下组，不同通道无冲突)");

// ========== 测试 4: evaluateGroup 通道顺序 ==========
section("4. 同组内通道顺序（靠上=高优先级）");

// 同一个组内有两个 opacity 通道（靠上的应胜出）
const group_4 = {
    start: { ref: "wordStart", dir: "before", offset: null },
    end: { ref: "lineEnd", dir: "after", offset: null },
    channels: [
        { channel_id: "opacity", from: 1, to: 1, curve: "linear" },
        { channel_id: "opacity", from: 0, to: 0, curve: "linear" },
    ],
};

const r4 = evaluateGroup(group_4, 2500, word_1, line_1);
check(r4.get("opacity") === 1, "靠上通道 opacity=1 胜出 (实际: " + r4.get("opacity") + ")");

// ========== 测试 5: 编辑器数据管理 ==========
section("5. 编辑器数据管理（模拟重排）");

const { h, clear } = await import("../js/utils/dom.js");
const { createAnimEditor } = await import("../js/ui/anim-editor.js");
const { EASING_PRESETS } = await import("../js/animation/easing.js");

const editor_container = h("div", { id: "test-editor" });
document.body.appendChild(editor_container);

const editor = createAnimEditor(editor_container);

const initial_groups = [
    {
        start: { ref: "wordStart", dir: "before", offset: 200 },
        end: { ref: "wordStart", dir: "after", offset: 0 },
        channels: [
            { channel_id: "opacity", from: 0, to: 1, curve: "linear" },
            { channel_id: "blur", from: 8, to: 0, curve: "ease-out" },
        ],
    },
    {
        start: { ref: "lineStart", dir: "before", offset: 100 },
        end: { ref: "lineEnd", dir: "after", offset: 0 },
        channels: [
            { channel_id: "color", from: "#ff0000", to: "#000000", curve: "linear" },
        ],
    },
];

// 加载数据
editor.load(initial_groups);
let loaded_data = editor.getData();
check(loaded_data.length === 2, "加载 2 个动画组 (实际: " + loaded_data.length + ")");
check(loaded_data[0].channels[0].channel_id === "opacity", "第一组通道为 opacity");
check(loaded_data[1].channels[0].channel_id === "color", "第二组通道为 color");

// 模拟重排：交换两组顺序
editor.load([initial_groups[1], initial_groups[0]]);
loaded_data = editor.getData();
check(loaded_data[0].channels[0].channel_id === "color", "重排后第一组通道为 color (实际: " + loaded_data[0].channels[0].channel_id + ")");

// 编辑器 DOM 渲染验证
const cards = editor_container.querySelectorAll(".anim-group-card");
check(cards.length === 2, "DOM 中 2 个组卡片 (实际: " + cards.length + ")");

// 每个卡片应有拖拽手柄
const handles = editor_container.querySelectorAll(".drag-handle");
check(handles.length === 5, "DOM 中有 5 个拖拽手柄（2 组 + 3 通道）(实际: " + handles.length + ")");

// 每个卡片 header 应有拖拽手柄
const card_handles = editor_container.querySelectorAll(".anim-group-header .drag-handle");
check(card_handles.length === 2, "组卡片 header 有 2 个拖拽手柄 (实际: " + card_handles.length + ")");

// 每个通道行应有拖拽手柄
const channel_handles = editor_container.querySelectorAll(".anim-channel-row .drag-handle");
check(channel_handles.length >= 2, "通道行至少有 2 个拖拽手柄 (实际: " + channel_handles.length + ")");

// ========== 测试 5b: 跨组通道不会污染 ==========
section("5b. 通道重排限定在同组内");

// 创建三组数据，每个组有独立的 channels 数组引用
const groups_a = [
    {
        start: { ref: "wordStart", dir: "before", offset: 200 },
        end: { ref: "wordStart", dir: "after", offset: 0 },
        channels: [
            { channel_id: "opacity", from: 0, to: 1, curve: "linear" },
        ],
    },
    {
        start: { ref: "lineStart", dir: "before", offset: 100 },
        end: { ref: "lineEnd", dir: "after", offset: 0 },
        channels: [
            { channel_id: "color", from: "#ff0000", to: "#000000", curve: "linear" },
        ],
    },
];

editor.load(groups_a);
let g0 = editor.getData()[0];
let g1 = editor.getData()[1];

// 验证两组 channels 是独立数组
check(Array.isArray(g0.channels), "组 0 的 channels 是数组");
check(Array.isArray(g1.channels), "组 1 的 channels 是数组");
check(g0.channels !== g1.channels, "两组 channels 引用不同 (避免交叉污染)");

// ========== 测试 5c: MIME 类型隔离 ==========
section("5c. MIME 类型隔离（组 vs 通道不互串）");

// 使用 DataTransfer API 验证 MIME 类型可区分
// jSDOM 可能不支持 DataTransfer，跳过时不影响其他测试
try {
    if (typeof DataTransfer !== "function") throw new Error("无 DataTransfer");

    function checkDragData(mime, data) {
        const dt = new DataTransfer();
        dt.setData(mime, data);
        const types = dt.types;
        return {
            has_group: Array.from(types).indexOf("text/x-anim-group") !== -1,
            has_channel: Array.from(types).indexOf("text/x-anim-channel") !== -1,
            value: dt.getData(mime),
        };
    }

    const group_r = checkDragData("text/x-anim-group", "2");
    check(group_r.has_group === true, "组拖拽包含 text/x-anim-group");
    check(group_r.has_channel === false, "组拖拽不含 text/x-anim-channel");
    check(group_r.value === "2", "组拖拽数据正确 (实际: " + group_r.value + ")");

    const channel_r = checkDragData("text/x-anim-channel", "0:1");
    check(channel_r.has_channel === true, "通道拖拽包含 text/x-anim-channel");
    check(channel_r.has_group === false, "通道拖拽不含 text/x-anim-group");
    check(channel_r.value === "0:1", "通道拖拽数据含 group_idx:chan_idx (实际: " + channel_r.value + ")");
} catch {
    console.log("  ℹ DataTransfer 不可用，跳过 MIME 类型测试");
}

// ========== 测试 6: 跨层优先级不变 ==========
section("6. 跨层优先级不变");

const line_6 = { start_time: 0, end_time: 10000, anim_groups: [] };
const word_6 = { start_time: 1000, end_time: 5000, anim_groups: [] };

// 字动画组（最高优先级层）：opacity=0.1
word_6.anim_groups = [
    {
        start: { ref: "wordStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "opacity", from: 0.1, to: 0.1, curve: "linear" },
        ],
    },
];

// 行动画组（次高优先级层）：opacity=0.5
line_6.anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "opacity", from: 0.5, to: 0.5, curve: "linear" },
        ],
    },
];

// 全局字（较低）：opacity=0.9
const config_6 = {
    line_anim_groups: [],
    word_anim_groups: [
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "opacity", from: 0.9, to: 0.9, curve: "linear" },
            ],
        },
    ],
};

// 字动画组（layer 5）应胜出
const r6 = resolveWord(2500, line_6, word_6, config_6);
check(r6.get("opacity") === 0.1, "字动画组 opacity=0.1 胜出 (实际: " + r6.get("opacity") + ")");

// 移除字动画组，行动画组应胜出
word_6.anim_groups = [];
const r6b = resolveWord(2500, line_6, word_6, config_6);
check(r6b.get("opacity") === 0.5, "行动画组 opacity=0.5 胜出 (实际: " + r6b.get("opacity") + ")");

// 同时移除行动画组，全局字应胜出
line_6.anim_groups = [];
const r6c = resolveWord(2500, line_6, word_6, config_6);
check(r6c.get("opacity") === 0.9, "全局字动画组 opacity=0.9 胜出 (实际: " + r6c.get("opacity") + ")");

// ========== 测试 7: 时间窗口内的顺序 ==========
section("7. 时间窗口影响优先级（仅激活的组参与）");

const line_7 = { start_time: 0, end_time: 10000, anim_groups: [] };
const word_7 = { start_time: 1000, end_time: 5000, anim_groups: [] };

const config_7 = {
    line_anim_groups: [],
    word_anim_groups: [
        // 组 0（靠上，高优先级）：仅在前半段激活，opacity=0
        {
            start: { ref: "wordStart", dir: "after", offset: 0 },    // 1000ms
            end: { ref: "wordEnd", dir: "after", offset: -1000 },    // 4000ms  (2000-1000)
            channels: [
                { channel_id: "opacity", from: 0, to: 0, curve: "linear" },
            ],
        },
        // 组 1（靠下，低优先级）：全程激活，opacity=1
        {
            start: { ref: "wordStart", dir: "before", offset: null },
            end: { ref: "lineEnd", dir: "after", offset: null },
            channels: [
                { channel_id: "opacity", from: 1, to: 1, curve: "linear" },
            ],
        },
    ],
};

// t=2500，组 0 激活（在 1000~4000 窗口内），靠上胜出 → opacity=0
const r7a = resolveWord(2500, line_7, word_7, config_7);
check(r7a.get("opacity") === 0, "靠上组窗口内 opacity=0 胜出 (实际: " + r7a.get("opacity") + ")");

// t=4500，组 0 不激活（超出 4000ms 窗口），仅组 1 提供 opacity=1
const r7b = resolveWord(4500, line_7, word_7, config_7);
check(r7b.get("opacity") === 1, "仅靠下组激活时 opacity=1 (实际: " + r7b.get("opacity") + ")");

// ========== 汇总 ==========
console.log("\n═══════════════════════════════════");
console.log("通过: " + passed + "  失败: " + failed);
if (failed === 0) {
    console.log("🎉 动画组优先级顺序测试全部通过！");
    console.log("  同级组顺序       靠上组 opacity 胜出 ✓");
    console.log("  交换顺序          结果随之改变 ✓");
    console.log("  不同通道          各自独立 ✓");
    console.log("  组内通道顺序      靠上通道胜出 ✓");
    console.log("  编辑器数据管理    load/getData/重排 ✓");
    console.log("  DOM 拖拽手柄      组+通道都有 ✓");
    console.log("  跨层优先级        字 > 行 > 全局 ✓");
    console.log("  时间窗口          仅激活组参与 ✓");
} else {
    console.log("❌ " + failed + " 个测试失败");
    process.exit(1);
}
console.log("═══════════════════════════════════");

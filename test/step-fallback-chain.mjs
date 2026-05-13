/**
 * 通道级动画回退链测试
 *
 * 测试场景：
 * 1. 字动画组：wordStart -> lineEnd, opacity=1
 * 2. 全局默认组：-Infinity -> +Infinity, opacity=0
 *
 * 预期行为：
 * - wordStart 之前：由于字动画未激活，回退到全局默认组，opacity=0
 * - wordStart 到 lineEnd：字动画激活，opacity=1
 * - lineEnd 之后：字动画失效，再次回退到全局默认组，opacity=0
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

const { resolveWord } = await import("../js/animation/resolver.js");
const { createDefaultConfig } = await import("../js/ttml/types.js");

// 构造测试数据
const line = {
    start_time: 1000,
    end_time: 5000,
    anim_groups: []
};

const word = {
    start_time: 2000,
    end_time: 3000,
    // 字动画组：仅在 2000ms -> 5000ms 期间 opacity=1
    anim_groups: [
        {
            start: { ref: "wordStart", dir: "after", offset: 0 }, // 2000ms
            end: { ref: "lineEnd", dir: "after", offset: 0 },   // 5000ms
            channels: [
                { channel_id: "opacity", from: 1, to: 1, curve: "linear" },
                { channel_id: "color", from: "#ff0000", to: "#ff0000", curve: "linear" }
            ]
        }
    ]
};

// 全局默认配置：包含 -∞ -> +∞ 的基础样式 (opacity=0)
// 以及 wordStart -> lineEnd 的出现动画 (opacity=1)
const config = {
    word_anim_groups: [],
    line_anim_groups: []
};

// 1. 测试字动画激活期间 (t=2500ms)
const styles_active = resolveWord(2500, line, word, config);
check(styles_active.get("opacity") === 1, "激活期间: opacity = 1");
check(styles_active.get("color") === "#ff0000", "激活期间: color = #ff0000 (来自字动画)");

// 2. 测试字动画开始前 (t=1500ms)
// 此时字动画未激活，应该回退到 Default 全局字动画组 (基础样式 opacity=0)
const styles_before = resolveWord(1500, line, word, config);
check(styles_before.get("opacity") === 0, "开始前: opacity = 0 (回退到 Default 基础样式)");
// color 在 Default 基础样式中是 #ffffff
check(styles_before.get("color") === "#ffffff", "开始前: color = #ffffff (来自 Default 基础样式)");

// 3. 测试字动画结束后 (t=5500ms)
// 此时字动画失效，应该回退到 Default 全局配置
const styles_after = resolveWord(5500, line, word, config);
check(styles_after.get("opacity") === 0, "结束后: opacity = 0 (再次回退到 Default 基础样式)");

// 4. 混合优先级测试
// 添加一个全局自定义动画，覆盖 color 但不覆盖 opacity
config.word_anim_groups = [
    {
        start: { ref: "lineStart", dir: "before", offset: null },
        end: { ref: "lineEnd", dir: "after", offset: null },
        channels: [
            { channel_id: "color", from: "#00ff00", to: "#00ff00", curve: "linear" }
        ]
    }
];

const styles_mixed = resolveWord(2500, line, word, config);
check(styles_mixed.get("opacity") === 1, "混合测试: opacity = 1 (来自字动画)");
check(styles_mixed.get("color") === "#ff0000", "混合测试: color = #ff0000 (字动画优先于全局自定义)");

const styles_mixed_before = resolveWord(1500, line, word, config);
check(styles_mixed_before.get("opacity") === 0, "混合测试(前): opacity = 0 (回退到 Default)");
check(styles_mixed_before.get("color") === "#00ff00", "混合测试(前): color = #00ff00 (来自全局自定义，覆盖了 Default)");

// 汇总
console.log("\n═══════════════════════════════════");
console.log("通过: " + passed + "  失败: " + failed);
if (failed === 0) {
    console.log("🎉 通道级动画回退链测试全部通过！");
} else {
    process.exit(1);
}

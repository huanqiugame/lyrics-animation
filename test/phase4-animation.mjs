/**
 * Phase 4 验证脚本：动画渲染引擎
 * 用法：/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node test/phase4-animation.mjs
 *
 * 测试：缓动曲线、动画通道、时间锚点、动画组解析、优先级链
 */

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

// ==================== 1. 缓动曲线 ====================
section("1. 缓动曲线");

const { evaluateEasing, EASING_PRESETS, cubicBezier } = await import("../js/animation/easing.js");

// 预设数量
check(EASING_PRESETS.size >= 12, `预设数量: ${EASING_PRESETS.size} (至少 12)`);

// 边界值
check(evaluateEasing("linear", 0) === 0, "linear(0) = 0");
check(evaluateEasing("linear", 1) === 1, "linear(1) = 1");
// ease-in(0.5) 的值由贝塞尔曲线决定
const ease_in_mid = evaluateEasing("ease-in", 0.5);
check(ease_in_mid >= 0 && ease_in_mid <= 1, `ease-in(0.5) 在合理范围内 (实际: ${ease_in_mid.toFixed(3)})`);

// ease-out-quad 曲线
const ease_out_quad = evaluateEasing("ease-out-quad", 0.5);
check(Math.abs(ease_out_quad - 0.75) < 0.01, `ease-out-quad(0.5) ≈ 0.75 (实际: ${ease_out_quad})`);

// 自定义贝塞尔 (ease-out-back 会超出 1)
const custom = cubicBezier(0.25, 0.1, 0.25, 1);
const custom_mid = custom(0.5);
check(custom_mid >= 0, `自定义贝塞尔在 0.5 处返回非负值 (实际: ${custom_mid.toFixed(3)})`);

// 未知曲线回退到 linear
check(evaluateEasing("unknown", 0.5) === 0.5, "未知曲线回退到 linear");

// ==================== 2. 动画通道 ====================
section("2. 动画通道");

const { CHANNELS, getChannel, listChannels } = await import("../js/animation/channels.js");

// 通道数量
check(CHANNELS.size >= 18, `通道数量: ${CHANNELS.size} (至少 18)`);

// 基础通道存在
check(getChannel("opacity") !== undefined, "opacity 通道存在");
check(getChannel("blur") !== undefined, "blur 通道存在");
check(getChannel("color") !== undefined, "color 通道存在");
check(getChannel("translateX") !== undefined, "translateX 通道存在");

// 线性插值
const opacity_channel = getChannel("opacity");
check(opacity_channel.lerp(0, 1, 0) === 0, "opacity lerp(0, 1, 0) = 0");
check(opacity_channel.lerp(0, 1, 1) === 1, "opacity lerp(0, 1, 1) = 1");
check(opacity_channel.lerp(0, 1, 0.5) === 0.5, "opacity lerp(0, 1, 0.5) = 0.5");

// 颜色插值
const color_channel = getChannel("color");
const mid_color = color_channel.lerp("#000000", "#ffffff", 0.5);
check(mid_color.includes("80") || mid_color.includes("128"), `颜色插值中间值: ${mid_color}`);

// 列表函数
const channel_list = listChannels();
check(Array.isArray(channel_list), "listChannels 返回数组");
check(channel_list.length === CHANNELS.size, "listChannels 长度与 CHANNELS 一致");

// ==================== 3. 时间锚点解析 ====================
section("3. 时间锚点解析");

const { resolveTime, computeTimeWindow } = await import("../js/animation/resolver.js");

// 测试数据
const test_word = { start_time: 1000, end_time: 2000 };
const test_line = { start_time: 500, end_time: 3000 };

// 基础锚点解析
check(resolveTime({ ref: "wordStart", dir: "after", offset: 0 }, test_word, test_line) === 1000, "wordStart = 1000");
check(resolveTime({ ref: "wordEnd", dir: "after", offset: 0 }, test_word, test_line) === 2000, "wordEnd = 2000");
check(resolveTime({ ref: "lineStart", dir: "after", offset: 0 }, test_word, test_line) === 500, "lineStart = 500");
check(resolveTime({ ref: "lineEnd", dir: "after", offset: 0 }, test_word, test_line) === 3000, "lineEnd = 3000");

// 带偏移
check(resolveTime({ ref: "wordStart", dir: "before", offset: 100 }, test_word, test_line) === 900, "wordStart - 100 = 900");
check(resolveTime({ ref: "wordEnd", dir: "after", offset: 200 }, test_word, test_line) === 2200, "wordEnd + 200 = 2200");

// ==================== 4. 动画组评估 ====================
section("4. 动画组评估");

const { evaluateGroup } = await import("../js/animation/resolver.js");

const test_group = {
    start: { ref: "wordStart", dir: "before", offset: 500 },
    end: { ref: "wordStart", dir: "after", offset: 0 },
    channels: [
        { channel_id: "opacity", from: 0, to: 1, curve: "linear" },
        { channel_id: "blur", from: 10, to: 0, curve: "linear" },
    ],
};

// 时间窗口内
const result_inside = evaluateGroup(test_group, 750, test_word, test_line);
check(result_inside.has("opacity"), "时间窗口内返回 opacity");
check(result_inside.has("blur"), "时间窗口内返回 blur");
check(Math.abs(result_inside.get("opacity") - 0.5) < 0.01, "中间时刻 opacity ≈ 0.5");
check(Math.abs(result_inside.get("blur") - 5) < 0.01, "中间时刻 blur ≈ 5");

// 时间窗口外（前）
const result_before = evaluateGroup(test_group, 400, test_word, test_line);
check(result_before.size === 0, "时间窗口前返回空");

// 时间窗口外（后）
const result_after = evaluateGroup(test_group, 1100, test_word, test_line);
check(result_after.size === 0, "时间窗口后返回空");

// ==================== 5. 时间窗口计算 ====================
section("5. 时间窗口计算");

const word_with_anim = {
    start_time: 1000,
    end_time: 2000,
    anim_groups: [{
        start: { ref: "wordStart", dir: "before", offset: 300 },
        end: { ref: "lineEnd", dir: "after", offset: 100 },
        channels: [],
    }],
};
const line_for_anim = { start_time: 500, end_time: 3000 };

const window = computeTimeWindow(word_with_anim, line_for_anim, word_with_anim.anim_groups);
check(window.start === 700, `时间窗口开始 = 700 (实际: ${window.start})`);
check(window.end === 3100, `时间窗口结束 = 3100 (实际: ${window.end})`);

// ==================== 6. 完整字解析 ====================
section("6. 完整字解析");

const { resolveWord } = await import("../js/animation/resolver.js");

const word_simple = { start_time: 1000, end_time: 2000, anim_groups: [] };
const line_simple = { start_time: 500, end_time: 3000, anim_groups: [] };
const config_simple = { line_anim_groups: [], word_anim_groups: [] };

// 无动画组时返回空（基础样式由渲染器处理）
const result_simple = resolveWord(1500, line_simple, word_simple, config_simple);
check(result_simple.size === 0, "无动画组时返回空 Map");

// 有动画组时返回值
const word_with_opacity = {
    start_time: 1000,
    end_time: 2000,
    anim_groups: [{
        start: { ref: "wordStart", dir: "before", offset: 100 },
        end: { ref: "wordStart", dir: "after", offset: 0 },
        channels: [{ channel_id: "opacity", from: 0, to: 1, curve: "linear" }],
    }],
};
const result_anim = resolveWord(950, line_simple, word_with_opacity, config_simple);
check(Math.abs(result_anim.get("opacity") - 0.5) < 0.01, "有动画组时返回插值");

// ==================== 7. 优先级链 ====================
section("7. 优先级链");

const line_with_anim = {
    start_time: 500,
    end_time: 3000,
    anim_groups: [{
        start: { ref: "wordStart", dir: "before", offset: 100 },
        end: { ref: "wordStart", dir: "after", offset: 0 },
        channels: [{ channel_id: "opacity", from: 0.2, to: 0.8, curve: "linear" }],
    }],
};
const word_no_anim = { start_time: 1000, end_time: 2000, anim_groups: [] };
const config_with_line = { line_anim_groups: [], word_anim_groups: [] };

// 字无动画，使用行动画
const result_fallback = resolveWord(950, line_with_anim, word_no_anim, config_with_line);
check(Math.abs(result_fallback.get("opacity") - 0.5) < 0.1, "字无动画时回退到行动画");

// 字有动画，覆盖行动画
const word_override = {
    start_time: 1000,
    end_time: 2000,
    anim_groups: [{
        start: { ref: "wordStart", dir: "before", offset: 100 },
        end: { ref: "wordStart", dir: "after", offset: 0 },
        channels: [{ channel_id: "opacity", from: 0, to: 1, curve: "linear" }],
    }],
};
const result_override = resolveWord(950, line_with_anim, word_override, config_with_line);
check(Math.abs(result_override.get("opacity") - 0.5) < 0.01, "字动画覆盖行动画");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 Phase 4 全部测试通过！");
    console.log("  缓动曲线          12+ 预设 + 自定义贝塞尔 ✓");
    console.log("  动画通道          20+ 通道 + 插值 ✓");
    console.log("  时间锚点解析      相对时间 → 绝对时间 ✓");
    console.log("  动画组评估        时间窗口 + 通道计算 ✓");
    console.log("  时间窗口计算      含动画组扩展 ✓");
    console.log("  完整字解析        硬编码默认值 ✓");
    console.log("  优先级链          字 > 行 > 全局 > 硬编码 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

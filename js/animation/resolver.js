/**
 * 动画解析器
 * 核心计算引擎：根据时间锚点、动画组、通道计算当前时刻的 CSS 值
 */

import { evaluateEasing } from "./easing.js";
import { getChannel } from "./channels.js";

/**
 * 硬编码默认动画组（最终回退层）
 * 仅在没有任意动画组提供某通道值时生效
 * 从 -∞ 到 +∞ 始终有效，所有通道使用 from=to 保持恒定值
 */
const HARDCODED_DEFAULTS = [
    {
        start: { ref: "wordStart", dir: "before", offset: null },  // -∞
        end: { ref: "lineEnd", dir: "after", offset: null },       // +∞
        channels: [
            { channel_id: "fontFamily", from: "system-ui, -apple-system, sans-serif", to: "system-ui, -apple-system, sans-serif", curve: "linear" },
            { channel_id: "fontSize", from: 32, to: 32, curve: "linear" },
            { channel_id: "color", from: "#ffffff", to: "#ffffff", curve: "linear" },
            { channel_id: "textShadow", from: "none", to: "none", curve: "linear" },
            { channel_id: "textStroke", from: "none", to: "none", curve: "linear" },
            { channel_id: "opacity", from: 0, to: 0, curve: "linear" },
        ],
    },
];

/**
 * 解析时间锚点为绝对时间
 * @param {import('../ttml/types.js').TimeAnchor} anchor - 时间锚点
 * @param {import('../ttml/types.js').LyricWord} word - 当前字
 * @param {import('../ttml/types.js').LyricLine} line - 当前行
 * @returns {number} 绝对时间（毫秒）
 */
export function resolveTime(anchor, word, line) {
    const base_times = {
        wordStart: word.start_time,
        wordEnd: word.end_time,
        lineStart: line.start_time,
        lineEnd: line.end_time,
    };
    const base = base_times[anchor.ref] || 0;

    // 支持无限大 offset：null 或 Infinity 表示正/负无限
    // - null 且 dir === 'before' → 负无限
    // - null 且 dir === 'after' → 正无限
    // - Infinity → 正无限
    // - -Infinity → 负无限
    if (anchor.offset === null) {
        return anchor.dir === "before" ? -Infinity : Infinity;
    }
    if (anchor.offset === Infinity) return Infinity;
    if (anchor.offset === -Infinity) return -Infinity;

    return anchor.dir === "before" ? base - anchor.offset : base + anchor.offset;
}

/**
 * 计算动画组的时间窗口
 * @param {import('../ttml/types.js').AnimationGroup} group - 动画组
 * @param {import('../ttml/types.js').LyricWord} word - 当前字
 * @param {import('../ttml/types.js').LyricLine} line - 当前行
 * @returns {{start: number, end: number}} 时间窗口（毫秒）
 */
function computeGroupTimeWindow(group, word, line) {
    return {
        start: resolveTime(group.start, word, line),
        end: resolveTime(group.end, word, line),
    };
}

/**
 * 评估单个动画组
 * @param {import('../ttml/types.js').AnimationGroup} group - 动画组
 * @param {number} t - 当前时间（毫秒）
 * @param {import('../ttml/types.js').LyricWord} word - 当前字
 * @param {import('../ttml/types.js').LyricLine} line - 当前行
 * @returns {Map<string, *>} 通道 ID → 计算值
 */
export function evaluateGroup(group, t, word, line) {
    const result = new Map();
    const window = computeGroupTimeWindow(group, word, line);

    // 超出时间窗口，返回空
    if (t < window.start || t > window.end) {
        return result;
    }

    const duration = window.end - window.start;

    // 无限时间窗口（如 -∞ ~ +∞）：始终在窗口内，progress = 0.5 保持稳定值
    // 有限但零宽度窗口：跳过
    if (!isFinite(duration) || duration <= 0) {
        if (!isFinite(window.start) || !isFinite(window.end)) {
            // 无限窗口：使用 progress = 0.5，from 和 to 相同时 lerp 仍返回相同值
            // 逆序遍历：通道列表中靠上的（索引小）优先级高，后执行覆盖前执行
            for (let ci = group.channels.length - 1; ci >= 0; ci--) {
                const channel = group.channels[ci];
                const channel_def = getChannel(channel.channel_id);
                if (!channel_def) continue;
                const value = channel_def.lerp(channel.from, channel.to, 0.5);
                result.set(channel.channel_id, value);
            }
        }
        return result;
    }

    const progress = (t - window.start) / duration;

    // 评估每个通道（逆序：靠上的通道优先级高）
    for (let ci = group.channels.length - 1; ci >= 0; ci--) {
        const channel = group.channels[ci];
        const channel_def = getChannel(channel.channel_id);
        if (!channel_def) continue;

        const eased_progress = evaluateEasing(channel.curve, progress);
        const value = channel_def.lerp(channel.from, channel.to, eased_progress);
        result.set(channel.channel_id, value);
    }

    return result;
}

/**
 * 计算字的时间窗口（含动画组扩展）
 * @param {import('../ttml/types.js').LyricWord} word - 当前字
 * @param {import('../ttml/types.js').LyricLine} line - 当前行
 * @param {import('../ttml/types.js').AnimationGroup[]} anim_groups - 动画组列表
 * @returns {{start: number, end: number}} 时间窗口（毫秒）
 */
export function computeTimeWindow(word, line, anim_groups) {
    // 基础窗口：从字开始时间到行结束时间
    let start = word.start_time;
    let end = line.end_time;

    // 扩展窗口以包含动画组时间范围
    for (const group of anim_groups) {
        const group_start = resolveTime(group.start, word, line);
        const group_end = resolveTime(group.end, word, line);
        start = Math.min(start, group_start);
        end = Math.max(end, group_end);
    }

    return { start, end };
}

/**
 * 解析字的动画样式
 * 从最低优先级开始逐层叠加，高优先级覆盖低优先级的同名通道值。
 * 优先级（低→高）：
 *   硬编码默认值 → 全局行动画组 → 全局字动画组 → 行内行动画组 → 行内字动画组
 *
 * @param {number} t - 当前时间（毫秒）
 * @param {import('../ttml/types.js').LyricLine} line - 当前行
 * @param {import('../ttml/types.js').LyricWord} word - 当前字
 * @param {import('../ttml/types.js').AnimationConfig} config - 全局动画配置
 * @returns {Map<string, *>} 通道 ID → 计算值
 */
export function resolveWord(t, line, word, config) {
    const result = new Map();

    // 层 1: 硬编码默认值（始终有效，最低优先级 — 最终回退）
    for (const group of HARDCODED_DEFAULTS) {
        const group_result = evaluateGroup(group, t, word, line);
        for (const [channel_id, value] of group_result) {
            result.set(channel_id, value);
        }
    }

    // 层 2: 全局行动画组（config.line_anim_groups）
    // 逆序遍历：靠上的组（索引小）优先级高，后执行覆盖前执行
    if (config && config.line_anim_groups) {
        for (let gi = config.line_anim_groups.length - 1; gi >= 0; gi--) {
            const group_result = evaluateGroup(config.line_anim_groups[gi], t, word, line);
            for (const [channel_id, value] of group_result) {
                result.set(channel_id, value);
            }
        }
    }

    // 层 3: 全局字动画组（config.word_anim_groups）
    if (config && config.word_anim_groups) {
        for (let gi = config.word_anim_groups.length - 1; gi >= 0; gi--) {
            const group_result = evaluateGroup(config.word_anim_groups[gi], t, word, line);
            for (const [channel_id, value] of group_result) {
                result.set(channel_id, value);
            }
        }
    }

    // 层 4: 行内行动画组
    if (line.anim_groups && line.anim_groups.length > 0) {
        for (let gi = line.anim_groups.length - 1; gi >= 0; gi--) {
            const group_result = evaluateGroup(line.anim_groups[gi], t, word, line);
            for (const [channel_id, value] of group_result) {
                result.set(channel_id, value);
            }
        }
    }

    // 层 5: 行内字动画组（最高优先级）
    if (word.anim_groups && word.anim_groups.length > 0) {
        for (let gi = word.anim_groups.length - 1; gi >= 0; gi--) {
            const group_result = evaluateGroup(word.anim_groups[gi], t, word, line);
            for (const [channel_id, value] of group_result) {
                result.set(channel_id, value);
            }
        }
    }

    return result;
}

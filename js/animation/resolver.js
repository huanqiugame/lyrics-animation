/**
 * 动画解析器
 * 核心计算引擎：根据时间锚点、动画组、通道计算当前时刻的 CSS 值
 */

import { evaluateEasing } from "./easing.js";
import { getChannel } from "./channels.js";

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
    if (duration <= 0) {
        return result;
    }

    const progress = (t - window.start) / duration;

    // 评估每个通道
    for (const channel of group.channels) {
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
 * 仅返回被动画组修改的通道值，无动画组时返回空 Map
 * 基础样式由渲染器直接应用
 *
 * @param {number} t - 当前时间（毫秒）
 * @param {import('../ttml/types.js').LyricLine} line - 当前行
 * @param {import('../ttml/types.js').LyricWord} word - 当前字
 * @param {import('../ttml/types.js').AnimationConfig} config - 全局动画配置
 * @returns {Map<string, *>} 通道 ID → 计算值
 */
export function resolveWord(t, line, word, config) {
    const result = new Map();

    // 1. 确定使用哪个动画组列表
    let anim_groups = [];
    if (word.anim_groups && word.anim_groups.length > 0) {
        anim_groups = word.anim_groups;
    } else if (line.anim_groups && line.anim_groups.length > 0) {
        anim_groups = line.anim_groups;
    } else if (config && config.word_anim_groups && config.word_anim_groups.length > 0) {
        anim_groups = config.word_anim_groups;
    } else if (config && config.line_anim_groups && config.line_anim_groups.length > 0) {
        anim_groups = config.line_anim_groups;
    }

    // 2. 无动画组时返回空（基础样式由渲染器处理）
    if (anim_groups.length === 0) return result;

    // 3. 评估所有动画组，叠加结果（后组覆盖前组）
    for (const group of anim_groups) {
        const group_result = evaluateGroup(group, t, word, line);
        for (const [channel_id, value] of group_result) {
            result.set(channel_id, value);
        }
    }

    return result;
}

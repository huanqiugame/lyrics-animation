/**
 * 内部数据模型定义
 * 所有时间单位为毫秒（整数）
 */

import { getDefaultConfig } from "../config-loader.js";

// ---- 默认值 ----

export const DEFAULTS = {
    font_family: "system-ui, -apple-system, sans-serif",
    font_size: 32,              // px
    text_color: "#ffffff",
    text_shadow: "none",
    text_stroke: "none",
};

// ---- 工厂函数 ----

/**
 * @returns {import('./types.js').LyricWord}
 */
export function createLyricWord(word = "", start_time = 0, end_time = 0) {
    return {
        word,
        start_time,
        end_time,
        style: null,
        style_ref: null,
        anim_groups: [],
    };
}

/**
 * @returns {import('./types.js').LyricLine}
 */
export function createLyricLine() {
    return {
        id: "",
        words: [],
        translated_lyric: "",
        roman_lyric: "",
        start_time: 0,
        end_time: 0,
        is_duet: false,
        is_background: false,
        agent_id: "",
        style: null,
        style_ref: null,
        region_id: null,
        anim_groups: [],
    };
}

/**
 * @returns {import('./types.js').AnimationConfig}
 */
export function createEmptyConfig() {
    return {
        word_anim_groups: [],
        line_anim_groups: [],
    };
}

/**
 * @returns {import('./types.js').AnimationConfig}
 */
export function createDefaultConfig() {
    const src = getDefaultConfig();
    return JSON.parse(JSON.stringify(src));
}

/**
 * 创建硬编码默认值（最终回退）
 * 仅包含 docs/animation-definition.md 中指定的基础设定：
 * - 系统字体、32px、白色、无阴影、无描边
 * @returns {Object}
 */
export function createHardcodedDefaults() {
    return {
        font_family: "system-ui, -apple-system, sans-serif",
        font_size: 32,
        color: "#ffffff",
        text_shadow: "none",
        text_stroke: "none",
    };
}

/**
 * @returns {import('./types.js').ProjectData}
 */
export function createEmptyProject() {
    return {
        version: 1,
        title: null,
        lang: "en-US",
        lyrics: [],
        agents: [],
        styles: {},
        regions: {},
        anim_config: createEmptyConfig(),
        default_anim_config: createDefaultConfig(),
        audio_file_name: null,
    };
}

// JSDoc 类型定义（用于 IDE 提示）
// 实际运行时不需要这些，仅作文档和开发参考

/**
 * @typedef {object} WordStyle
 * @property {number} [scale]  - 缩放倍数
 * @property {string} [color]  - CSS 颜色
 * @property {boolean} [bold]  - 加粗
 */

/**
 * @typedef {object} LyricWord
 * @property {string} word
 * @property {number} start_time
 * @property {number} end_time
 * @property {WordStyle|null} style
 * @property {string|null} style_ref - 引用的 TTML style id
 * @property {AnimationGroup[]} anim_groups
 */

/**
 * @typedef {object} LineStyle
 * @property {number} [scale]
 * @property {string} [color]
 */

/**
 * @typedef {object} LyricLine
 * @property {string} id
 * @property {LyricWord[]} words
 * @property {string} translated_lyric
 * @property {string} roman_lyric
 * @property {number} start_time
 * @property {number} end_time
 * @property {boolean} is_duet
 * @property {boolean} is_background
 * @property {string} agent_id
 * @property {LineStyle|null} style
 * @property {string|null} style_ref
 * @property {string|null} region_id
 * @property {AnimationGroup[]} anim_groups
 */

/**
 * @typedef {object} TimeAnchor
 * @property {string} ref - 'wordStart' | 'wordEnd' | 'lineStart' | 'lineEnd'
 * @property {string} dir - 'before' | 'after'
 * @property {number} offset - 偏移量（毫秒）
 */

/**
 * @typedef {object} AnimChannel
 * @property {string} channel_id - 通道 ID
 * @property {*} from - 起始值
 * @property {*} to - 结束值
 * @property {string} curve - 缓动曲线 ID
 */

/**
 * @typedef {object} AnimationGroup
 * @property {string} scope - 作用域: "all" | "standard" | "duet" | "background"
 * @property {TimeAnchor} start - 动画开始时间锚点
 * @property {TimeAnchor} end - 动画结束时间锚点
 * @property {AnimChannel[]} channels - 动画通道列表
 */

/**
 * @typedef {object} AgentInfo
 * @property {string} id
 * @property {string} type - 'person' | 'group' | 'other'
 * @property {string} name
 */

/**
 * @typedef {object} TtmlStyle
 * @property {string} id
 * @property {Record<string, string>} properties - tts 属性（键不含 tts: 前缀）
 */

/**
 * @typedef {object} RegionInfo
 * @property {string} id
 * @property {string} origin
 * @property {string} extent
 * @property {string} text_align
 * @property {string} display_align
 * @property {string|null} style_ref
 */

/**
 * @typedef {object} AnimationConfig
 * @property {AnimationGroup[]} line_anim_groups - 全局行动画组
 * @property {AnimationGroup[]} word_anim_groups - 全局字动画组
 */

/**
 * @typedef {object} ProjectData
 * @property {number} version
 * @property {string|null} title
 * @property {string} lang
 * @property {LyricLine[]} lyrics
 * @property {AgentInfo[]} agents
 * @property {Record<string, TtmlStyle>} styles
 * @property {Record<string, RegionInfo>} regions
 * @property {AnimationConfig} anim_config - 自定义全局动画配置（用户可编辑）
 * @property {AnimationConfig} default_anim_config - 默认全局动画配置（初始为空，通过 Alt+导入填充）
 * @property {string|null} audio_file_name
 */

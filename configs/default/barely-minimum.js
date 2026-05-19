/**
 * "barely-minimum" 默认全局动画组预设
 *
 * 提供最低限度的基础动画效果：
 * - 字出现/消失（不透明度控制）
 * - 基础样式（字体、颜色、阴影、描边）
 * - 行锚点定位（画布左侧 + 偏移）
 * - 文字对齐
 *
 * 可通过 js/config-loader.js 加载切换不同预设。
 * 对应 JSON 版本见 barely-minimum.json。
 */

const word_anim_groups = [
    // 出现动画（第一=最高优先级）：在 wordStart ~ lineEnd 期间，opacity=1
    {
        start: { ref: "wordStart", dir: "before", offset: 0 },
        end: { ref: "lineEnd", dir: "after", offset: 0 },
        channels: [
            { channel_id: "opacity", from: 1, to: 1, curve: "linear" },
        ],
    },
    // 基础样式组（第二=较低优先级）：-∞ ~ +∞，默认字体、颜色等 + 默认不可见（opacity=0）
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

const line_anim_groups = [
    // 锚点定位（第一=最高优先级）：画布左侧 + X偏移20px
    {
        start: { ref: "lineStart", dir: "before", offset: null },  // -∞
        end: { ref: "lineEnd", dir: "after", offset: null },       // +∞
        channels: [
            { channel_id: "anchorPosition", from: "left", to: "left", curve: "linear" },
            { channel_id: "anchorOffsetX", from: 20, to: 20, curve: "linear" },
            { channel_id: "anchorOffsetY", from: 0, to: 0, curve: "linear" },
            { channel_id: "anchorOffsetZ", from: 0, to: 0, curve: "linear" },
        ],
    },
    // 基础行样式（第二）：文字左对齐
    {
        start: { ref: "lineStart", dir: "before", offset: null },  // -∞
        end: { ref: "lineEnd", dir: "after", offset: null },       // +∞
        channels: [
            { channel_id: "textAlign", from: "left", to: "left", curve: "linear" },
        ],
    },
];

export const DEFAULT_CONFIG = {
    word_anim_groups,
    line_anim_groups,
};

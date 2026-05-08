/**
 * 动画通道注册表
 * 每个通道定义一个可动画化的 CSS 属性
 */

/**
 * 解析颜色字符串为 RGB 数组
 * @param {string} color - 颜色字符串（支持 #rgb, #rrggbb, rgb(), rgba()）
 * @returns {[number, number, number, number]} [r, g, b, a]
 */
function parseColor(color) {
    const hex_match = color.match(/^#?([0-9a-f]{3,8})$/i);
    if (hex_match) {
        let hex = hex_match[1];
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return [r, g, b, a];
    }

    const rgb_match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgb_match) {
        return [
            parseInt(rgb_match[1]),
            parseInt(rgb_match[2]),
            parseInt(rgb_match[3]),
            rgb_match[4] ? parseFloat(rgb_match[4]) : 1,
        ];
    }

    return [0, 0, 0, 1];
}

/**
 * 将 RGB 数组转换为颜色字符串
 * @param {[number, number, number, number]} rgba
 * @returns {string}
 */
function toColorString([r, g, b, a]) {
    r = Math.round(Math.max(0, Math.min(255, r)));
    g = Math.round(Math.max(0, Math.min(255, g)));
    b = Math.round(Math.max(0, Math.min(255, b)));
    a = Math.max(0, Math.min(1, a));
    if (a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * 在两个颜色之间插值
 * @param {string} from - 起始颜色
 * @param {string} to - 结束颜色
 * @param {number} t - 进度 [0, 1]
 * @returns {string}
 */
function lerpColor(from, to, t) {
    const [r1, g1, b1, a1] = parseColor(from);
    const [r2, g2, b2, a2] = parseColor(to);
    return toColorString([
        r1 + (r2 - r1) * t,
        g1 + (g2 - g1) * t,
        b1 + (b2 - b1) * t,
        a1 + (a2 - a1) * t,
    ]);
}

/**
 * 在两个数值之间线性插值
 * @param {number} from
 * @param {number} to
 * @param {number} t - 进度 [0, 1]
 * @returns {number}
 */
function lerpNumber(from, to, t) {
    return from + (to - from) * t;
}

/**
 * 创建 transform 通道的 apply 函数
 * 需要收集所有 transform 属性后一次性设置
 * @param {string} property - transform 属性名
 * @returns {(element: HTMLElement, value: any) => void}
 */
function createTransformApply(property) {
    return (element, value) => {
        // 存储到元素的自定义属性上
        const transforms = element.__transforms || {};
        element.__transforms = transforms;
        transforms[property] = value;

        // 组装所有 transform
        const parts = [];
        for (const [key, val] of Object.entries(transforms)) {
            if (key === "translateX") parts.push(`translateX(${val}px)`);
            else if (key === "translateY") parts.push(`translateY(${val}px)`);
            else if (key === "translateZ") parts.push(`translateZ(${val}px)`);
            else if (key === "rotateX") parts.push(`rotateX(${val}deg)`);
            else if (key === "rotateY") parts.push(`rotateY(${val}deg)`);
            else if (key === "rotateZ") parts.push(`rotateZ(${val}deg)`);
            else if (key === "scale") parts.push(`scale(${val})`);
        }
        element.style.transform = parts.length > 0 ? parts.join(" ") : "";
    };
}

/**
 * @typedef {object} ChannelDef
 * @property {string} id - 通道唯一 ID
 * @property {string} label - 显示名称
 * @property {string|null} cssProperty - CSS 属性名（null 表示自定义 apply）
 * @property {any} defaultValue - 默认值
 * @property {string|null} unit - CSS 单位
 * @property {(from: any, to: any, t: number) => any} lerp - 插值函数
 * @property {(element: HTMLElement, value: any) => void} apply - 应用到 DOM
 */

/** @type {Map<string, ChannelDef>} */
export const CHANNELS = new Map([
    // Visibility
    ["opacity", {
        id: "opacity",
        label: "不透明度",
        cssProperty: "opacity",
        defaultValue: 1,
        unit: null,
        lerp: lerpNumber,
        apply: (el, v) => {
            el.style.opacity = v;
            // opacity=0 时设置 display:none，元素不占空间
            // 这样文字对齐时未出现的字不影响布局
            if (v === 0) {
                el.style.display = "none";
            } else {
                el.style.display = "";
            }
        },
    }],

    // Blur
    ["blur", {
        id: "blur",
        label: "模糊",
        cssProperty: "filter",
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: (el, v) => {
            // 合并已有的 filter 值
            const current = el.style.filter || "";
            const without_blur = current.replace(/blur\([^)]*\)/g, "").trim();
            if (v === 0) {
                el.style.filter = without_blur;
            } else {
                const blur_str = `blur(${v}px)`;
                el.style.filter = without_blur ? `${blur_str} ${without_blur}` : blur_str;
            }
        },
    }],

    // Colors
    ["color", {
        id: "color",
        label: "文字颜色",
        cssProperty: "color",
        defaultValue: "#ffffff",
        unit: null,
        lerp: lerpColor,
        apply: (el, v) => { el.style.color = v; },
    }],
    ["backgroundColor", {
        id: "backgroundColor",
        label: "背景颜色",
        cssProperty: "background-color",
        defaultValue: "transparent",
        unit: null,
        lerp: lerpColor,
        apply: (el, v) => { el.style.backgroundColor = v; },
    }],

    // Text styling
    ["fontFamily", {
        id: "fontFamily",
        label: "字体",
        cssProperty: "font-family",
        defaultValue: "system-ui, -apple-system, sans-serif",
        unit: null,
        // 字体无法插值，使用 step 方式切换
        lerp: (from, to, t) => t < 0.5 ? from : to,
        apply: (el, v) => { el.style.fontFamily = v; },
    }],
    ["textAlign", {
        id: "textAlign",
        label: "文字对齐",
        cssProperty: null,  // 特殊处理：同时设置 text-align 和 justify-content
        defaultValue: "left",
        unit: null,
        // 对齐方式无法插值，使用 step 方式切换
        lerp: (from, to, t) => t < 0.5 ? from : to,
        apply: (el, v) => {
            // 设置行元素的 text-align 和 justify-content
            el.style.textAlign = v;
            // 根据 textAlign 设置 justify-content
            const justify_map = {
                left: "flex-start",
                center: "center",
                right: "flex-end",
                start: "flex-start",
                end: "flex-end",
            };
            el.style.justifyContent = justify_map[v] || "center";
        },
    }],
    // Anchor position (canvas reference point)
    ["anchorPosition", {
        id: "anchorPosition",
        label: "锚点位置",
        cssProperty: null,  // 特殊处理：影响定位逻辑
        defaultValue: "center",
        unit: null,
        lerp: (from, to, t) => t < 0.5 ? from : to,  // step 切换
        apply: (el, v) => {
            // 存储锚点位置供渲染器使用
            el.__anchorPosition = v;
        },
    }],
    ["anchorOffsetX", {
        id: "anchorOffsetX",
        label: "锚点 X 偏移",
        cssProperty: null,
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: (el, v) => { el.__anchorOffsetX = v; },
    }],
    ["anchorOffsetY", {
        id: "anchorOffsetY",
        label: "锚点 Y 偏移",
        cssProperty: null,
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: (el, v) => { el.__anchorOffsetY = v; },
    }],
    ["anchorOffsetZ", {
        id: "anchorOffsetZ",
        label: "锚点 Z 偏移",
        cssProperty: null,
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: (el, v) => { el.__anchorOffsetZ = v; },
    }],
    ["textShadow", {
        id: "textShadow",
        label: "文字阴影",
        cssProperty: "text-shadow",
        defaultValue: "none",
        unit: null,
        lerp: (from, to, t) => t < 0.5 ? from : to,
        apply: (el, v) => { el.style.textShadow = v; },
    }],
    ["textStroke", {
        id: "textStroke",
        label: "文字描边",
        cssProperty: "-webkit-text-stroke",
        defaultValue: "none",
        unit: null,
        lerp: (from, to, t) => t < 0.5 ? from : to,
        apply: (el, v) => {
            if (v === "none") {
                el.style.webkitTextStroke = "";
            } else {
                el.style.webkitTextStroke = v;
            }
        },
    }],
    ["fontWeight", {
        id: "fontWeight",
        label: "字体粗细",
        cssProperty: "font-weight",
        defaultValue: 400,
        unit: null,
        lerp: lerpNumber,
        apply: (el, v) => { el.style.fontWeight = v; },
    }],

    // Sizing
    ["fontSize", {
        id: "fontSize",
        label: "字体大小",
        cssProperty: "font-size",
        defaultValue: 32,
        unit: "px",
        lerp: lerpNumber,
        apply: (el, v) => { el.style.fontSize = v + "px"; },
    }],
    ["lineHeight", {
        id: "lineHeight",
        label: "行高",
        cssProperty: "line-height",
        defaultValue: 1.5,
        unit: null,
        lerp: lerpNumber,
        apply: (el, v) => { el.style.lineHeight = v; },
    }],

    // Border
    ["borderWidth", {
        id: "borderWidth",
        label: "边框宽度",
        cssProperty: "border-width",
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: (el, v) => {
            el.style.borderWidth = v + "px";
            el.style.borderStyle = v > 0 ? "solid" : "none";
        },
    }],
    ["borderColor", {
        id: "borderColor",
        label: "边框颜色",
        cssProperty: "border-color",
        defaultValue: "transparent",
        unit: null,
        lerp: lerpColor,
        apply: (el, v) => { el.style.borderColor = v; },
    }],
    ["borderRadius", {
        id: "borderRadius",
        label: "圆角半径",
        cssProperty: "border-radius",
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: (el, v) => { el.style.borderRadius = v + "px"; },
    }],

    // Transform - Position
    ["translateX", {
        id: "translateX",
        label: "X 轴位移",
        cssProperty: null,
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: createTransformApply("translateX"),
    }],
    ["translateY", {
        id: "translateY",
        label: "Y 轴位移",
        cssProperty: null,
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: createTransformApply("translateY"),
    }],
    ["translateZ", {
        id: "translateZ",
        label: "Z 轴位移",
        cssProperty: null,
        defaultValue: 0,
        unit: "px",
        lerp: lerpNumber,
        apply: createTransformApply("translateZ"),
    }],

    // Transform - Rotation
    ["rotateX", {
        id: "rotateX",
        label: "X 轴旋转",
        cssProperty: null,
        defaultValue: 0,
        unit: "deg",
        lerp: lerpNumber,
        apply: createTransformApply("rotateX"),
    }],
    ["rotateY", {
        id: "rotateY",
        label: "Y 轴旋转",
        cssProperty: null,
        defaultValue: 0,
        unit: "deg",
        lerp: lerpNumber,
        apply: createTransformApply("rotateY"),
    }],
    ["rotateZ", {
        id: "rotateZ",
        label: "Z 轴旋转",
        cssProperty: null,
        defaultValue: 0,
        unit: "deg",
        lerp: lerpNumber,
        apply: createTransformApply("rotateZ"),
    }],

    // Transform - Scale
    ["scale", {
        id: "scale",
        label: "缩放",
        cssProperty: null,
        defaultValue: 1,
        unit: null,
        lerp: lerpNumber,
        apply: createTransformApply("scale"),
    }],

    // Layer
    ["zIndex", {
        id: "zIndex",
        label: "层级",
        cssProperty: "z-index",
        defaultValue: 0,
        unit: null,
        lerp: (from, to, t) => Math.round(lerpNumber(from, to, t)),
        apply: (el, v) => { el.style.zIndex = v; },
    }],
]);

/**
 * 获取通道定义
 * @param {string} id - 通道 ID
 * @returns {ChannelDef|undefined}
 */
export function getChannel(id) {
    return CHANNELS.get(id);
}

/**
 * 获取所有通道列表（用于 UI 枚举）
 * @returns {ChannelDef[]}
 */
export function listChannels() {
    return [...CHANNELS.values()];
}

/**
 * 将计算值应用到 DOM 元素
 * @param {HTMLElement} element
 * @param {string} channel_id
 * @param {any} value
 */
export function applyChannel(element, channel_id, value) {
    const channel = CHANNELS.get(channel_id);
    if (!channel) {
        console.warn(`未知通道: ${channel_id}`);
        return;
    }
    channel.apply(element, value);
}

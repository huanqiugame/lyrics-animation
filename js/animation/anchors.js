/**
 * 锚点系统
 * 定义 transform-origin 的位置
 */

/**
 * 文本相对锚点
 * 使用百分比表示 transform-origin
 */
const TEXT_ANCHORS = {
    "text-center":          { label: "文本中心",      origin: "50% 50%" },
    "text-top-left":        { label: "文本左上角",    origin: "0% 0%" },
    "text-top-center":      { label: "文本上边中点",  origin: "50% 0%" },
    "text-top-right":       { label: "文本右上角",    origin: "100% 0%" },
    "text-left-center":     { label: "文本左边中点",  origin: "0% 50%" },
    "text-right-center":    { label: "文本右边中点",  origin: "100% 50%" },
    "text-bottom-left":     { label: "文本左下角",    origin: "0% 100%" },
    "text-bottom-center":   { label: "文本下边中点",  origin: "50% 100%" },
    "text-bottom-right":    { label: "文本右下角",    origin: "100% 100%" },
};

/**
 * 画布相对锚点
 * 需要根据画布尺寸计算像素值
 */
const CANVAS_ANCHORS = {
    "canvas-center":        { label: "画布中心" },
    "canvas-top-left":      { label: "画布左上角" },
    "canvas-top-center":    { label: "画布上边中点" },
    "canvas-top-right":     { label: "画布右上角" },
    "canvas-left-center":   { label: "画布左边中点" },
    "canvas-right-center":  { label: "画布右边中点" },
    "canvas-bottom-left":   { label: "画布左下角" },
    "canvas-bottom-center": { label: "画布下边中点" },
    "canvas-bottom-right":  { label: "画布右下角" },
};

/** @type {Map<string, {label: string, getOrigin: (el: HTMLElement, canvasRect: DOMRect) => string}>} */
export const ANCHORS = new Map();

// 注册文本相对锚点
for (const [id, def] of Object.entries(TEXT_ANCHORS)) {
    ANCHORS.set(id, {
        label: def.label,
        getOrigin: () => def.origin,
    });
}

// 注册画布相对锚点
for (const [id, def] of Object.entries(CANVAS_ANCHORS)) {
    ANCHORS.set(id, {
        label: def.label,
        getOrigin: (element, canvas_rect) => {
            const el_rect = element.getBoundingClientRect();
            const cx = el_rect.left - canvas_rect.left + el_rect.width / 2;
            const cy = el_rect.top - canvas_rect.top + el_rect.height / 2;
            return `${cx}px ${cy}px`;
        },
    });
}

/**
 * 获取锚点定义
 * @param {string} id - 锚点 ID
 * @returns {{label: string, getOrigin: (el: HTMLElement, canvasRect: DOMRect) => string}}
 */
export function getAnchor(id) {
    return ANCHORS.get(id) || ANCHORS.get("text-center");
}

/**
 * 将锚点应用到 DOM 元素
 * @param {HTMLElement} element
 * @param {string} anchor_id
 * @param {DOMRect} canvas_rect - 画布的边界矩形
 */
export function applyAnchor(element, anchor_id, canvas_rect) {
    const anchor = getAnchor(anchor_id);
    element.style.transformOrigin = anchor.getOrigin(element, canvas_rect);
}

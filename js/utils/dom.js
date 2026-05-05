/**
 * DOM 辅助函数
 * 减少重复的 createElement + setAttribute + classList.add 模板代码
 */

/**
 * 创建带属性的 DOM 元素
 * @param {string} tag - HTML 标签名
 * @param {Record<string, string>} [attrs] - 属性键值对
 * @param {...(string|Node)} [children] - 子节点（字符串自动转为 TextNode）
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === "className") {
            el.className = value;
        } else if (key === "innerHTML") {
            el.innerHTML = value;
        } else if (key.startsWith("on")) {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    }
    for (const child of children) {
        if (child == null || child === false) continue;
        el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return el;
}

/**
 * 清空元素的所有子节点
 * @param {HTMLElement} el
 */
export function clear(el) {
    el.replaceChildren();
}

/**
 * 多类名合并（过滤假值）
 * @param  {...(string|false|null|undefined)} classes
 * @returns {string}
 */
export function cls(...classes) {
    return classes.filter(Boolean).join(" ");
}

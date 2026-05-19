/**
 * 全局动画配置加载器
 *
 * 管理默认全局动画组预设的加载和切换。
 * 预设数据存放在 configs/default/ 目录下，每个预设为一个 .js 模块。
 *
 * 当前预设："barely-minimum"（硬编码默认值的提取）
 * 未来可在此添加更多预设（如 "karaoke"、"fade-slide" 等）。
 */

import { DEFAULT_CONFIG as BARELY_MINIMUM } from "../configs/default/barely-minimum.js";

/** @type {import('./ttml/types.js').AnimationConfig|null} */
let current_preset = null;

/**
 * 获取当前激活的默认全局动画配置
 * 如果尚未加载预设，返回内置的 barely-minimum 预设
 * @returns {import('./ttml/types.js').AnimationConfig}
 */
export function getDefaultConfig() {
    return current_preset || BARELY_MINIMUM;
}

/**
 * 加载指定名称的预设
 * @param {string} name - 预设名称（如 "barely-minimum"）
 * @returns {import('./ttml/types.js').AnimationConfig}
 */
export function loadPreset(name) {
    switch (name) {
        case "barely-minimum":
            current_preset = null; // 将 getDefaultConfig 回退到内置预设
            break;
        // 未来在此添加更多预设
        // case "karaoke":
        //     import("../configs/default/karaoke.js").then(m => { current_preset = m.DEFAULT_CONFIG; });
        //     break;
        default:
            console.warn(`[config-loader] 未知预设: "${name}"，使用 barely-minimum`);
            current_preset = null;
    }
    return getDefaultConfig();
}

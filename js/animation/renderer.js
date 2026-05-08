/**
 * 动画渲染器
 * 字幕模式：所有歌词行在同一个固定位置依次出现和消失，
 * 不滚动，不偏移，如同电视节目字幕
 *
 * 显示控制：使用 opacity 而非 display:none，允许用户在歌词前后添加动画
 * 定位方式：所有行使用绝对定位，居中显示
 */

import { bus } from "../utils/events.js";
import { h, clear } from "../utils/dom.js";
import { resolveWord, computeTimeWindow } from "./resolver.js";
import { applyChannel, getChannel } from "./channels.js";
import { evaluateEasing } from "./easing.js";

/**
 * @typedef {import('../ttml/types.js').ProjectData} ProjectData
 * @typedef {import('../ttml/types.js').LyricLine} LyricLine
 * @typedef {import('../ttml/types.js').LyricWord} LyricWord
 */

export class AnimationRenderer {
    /** @type {HTMLElement} */
    #container;

    /** @type {HTMLElement|null} */
    #canvas = null;

    /** @type {ProjectData|null} */
    #project = null;

    /** @type {HTMLElement[][]} */
    #wordElements = [];

    /** @type {HTMLElement[]} */
    #lineElements = [];

    /** @type {number} */
    #currentTime = -1;

    /**
     * @param {HTMLElement} container - 预览容器 (#preview-content)
     */
    constructor(container) {
        this.#container = container;
        this.#bindEvents();
    }

    #bindEvents() {
        bus.on("lyrics:loaded", (project) => this.load(project));
        bus.on("config:changed", (config) => {
            if (this.#project) {
                this.#project.anim_config = config;
                this.updateTime(this.#currentTime);
            }
        });
        bus.on("audio:timeupdate", ({ currentTime }) => {
            this.#currentTime = currentTime;
            this.updateTime(currentTime);
        });
        bus.on("audio:seeked", ({ currentTime }) => {
            this.#currentTime = currentTime;
            this.updateTime(currentTime);
        });
    }

    /**
     * 加载项目数据，重建 DOM
     * @param {ProjectData} project
     */
    load(project) {
        this.#project = project;
        this.#wordElements = [];
        this.#lineElements = [];
        this.#currentTime = -1;

        clear(this.#container);

        this.#canvas = h("div", { className: "anim-canvas" });

        for (let line_idx = 0; line_idx < project.lyrics.length; line_idx++) {
            const line = project.lyrics[line_idx];
            const line_el = h("div", {
                className: "anim-line",
                "data-line-index": line_idx,
            });

            const word_els = [];
            for (let word_idx = 0; word_idx < line.words.length; word_idx++) {
                const word = line.words[word_idx];
                const word_el = h("span", { className: "anim-word" }, word.word);
                line_el.appendChild(word_el);
                word_els.push(word_el);
            }

            this.#canvas.appendChild(line_el);
            this.#lineElements.push(line_el);
            this.#wordElements.push(word_els);
        }

        this.#container.appendChild(this.#canvas);

        // 初始化：更新到 -1 时间点，应用默认动画组
        this.updateTime(-1);
    }

    /**
     * 更新当前时间，驱动动画
     * @param {number} t - 当前时间（毫秒）
     */
    updateTime(t) {
        if (!this.#project || !this.#canvas) return;

        const lyrics = this.#project.lyrics;
        const config = this.#project.anim_config;
        const canvas_rect = this.#canvas.getBoundingClientRect();

        // 遍历所有行，应用动画
        for (let line_idx = 0; line_idx < lyrics.length; line_idx++) {
            const line = lyrics[line_idx];
            const word_els = this.#wordElements[line_idx];
            const line_el = this.#lineElements[line_idx];

            // 行级动画：从全局行动画组或行自身动画组获取
            const line_styles = this.#resolveLineStyles(t, line, config);
            for (const [channel_id, value] of line_styles) {
                applyChannel(line_el, channel_id, value);
            }

            // 应用锚点定位
            this.#applyAnchorPosition(line_el, line_styles, canvas_rect);

            // 逐字处理
            for (let word_idx = 0; word_idx < line.words.length; word_idx++) {
                const word = line.words[word_idx];
                const word_el = word_els[word_idx];

                // 计算时间窗口（考虑动画组扩展）
                const anim_groups = this.#getAnimGroups(word, line, config);
                const time_window = computeTimeWindow(word, line, anim_groups);

                // 获取动画样式（包含 opacity 控制）
                const styles = resolveWord(t, line, word, config);

                // 应用所有通道值
                for (const [channel_id, value] of styles) {
                    applyChannel(word_el, channel_id, value);
                }
            }
        }
    }

    /**
     * 应用锚点定位
     * @param {HTMLElement} line_el
     * @param {Map<string, *>} line_styles
     * @param {DOMRect} canvas_rect
     */
    #applyAnchorPosition(line_el, line_styles, canvas_rect) {
        // 获取锚点位置（默认 center）
        const anchor_pos = line_styles.get("anchorPosition") || line_el.__anchorPosition || "center";
        const offset_x = line_styles.get("anchorOffsetX") ?? line_el.__anchorOffsetX ?? 0;
        const offset_y = line_styles.get("anchorOffsetY") ?? line_el.__anchorOffsetY ?? 0;
        const offset_z = line_styles.get("anchorOffsetZ") ?? line_el.__anchorOffsetZ ?? 0;

        // 获取文字对齐方式（默认 left）
        const text_align = line_styles.get("textAlign") || "left";

        // 计算画布参考点坐标（百分比）
        const anchor_coords = this.#getAnchorCoords(anchor_pos);

        // 根据对齐方式计算行元素的定位
        // textAlign 决定行的哪一边与锚点对齐
        let left_pct, transform_origin_x;

        if (text_align === "left") {
            // 行左端与锚点对齐
            left_pct = anchor_coords.x;
            transform_origin_x = "0%";
        } else if (text_align === "right") {
            // 行右端与锚点对齐
            left_pct = anchor_coords.x;
            transform_origin_x = "100%";
        } else {
            // center 或其他：行中心与锚点对齐
            left_pct = anchor_coords.x;
            transform_origin_x = "50%";
        }

        // 设置定位
        line_el.style.left = `${left_pct}%`;
        line_el.style.top = `${anchor_coords.y}%`;

        // 构建 transform：先平移到锚点，再应用偏移和 Z 轴位移
        // 基础 transform：translate(-50%, -50%) 使元素中心对准 left/top
        // 根据 textAlign 调整 X 方向的对齐
        let tx = "-50%";
        if (text_align === "left") {
            tx = "0%";
        } else if (text_align === "right") {
            tx = "-100%";
        }

        // 应用偏移量
        const final_tx = `calc(${tx} + ${offset_x}px)`;
        const final_ty = `calc(-50% + ${offset_y}px)`;

        // 组装 transform
        let transforms = [`translateX(${final_tx})`, `translateY(${final_ty})`];
        if (offset_z !== 0) {
            transforms.push(`translateZ(${offset_z}px)`);
        }
        line_el.style.transform = transforms.join(" ");
    }

    /**
     * 获取锚点位置对应的画布坐标（百分比）
     * @param {string} anchor_pos
     * @returns {{x: number, y: number}}
     */
    #getAnchorCoords(anchor_pos) {
        const coords = {
            center: { x: 50, y: 50 },
            topLeft: { x: 0, y: 0 },
            topRight: { x: 100, y: 0 },
            bottomLeft: { x: 0, y: 100 },
            bottomRight: { x: 100, y: 100 },
            top: { x: 50, y: 0 },
            bottom: { x: 50, y: 100 },
            left: { x: 0, y: 50 },
            right: { x: 100, y: 50 },
        };
        return coords[anchor_pos] || coords.center;
    }

    /**
     * 获取字的动画组列表（按优先级）
     * @param {LyricWord} word
     * @param {LyricLine} line
     * @param {import('../ttml/types.js').AnimationConfig} config
     * @returns {import('../ttml/types.js').AnimationGroup[]}
     */
    #getAnimGroups(word, line, config) {
        if (word.anim_groups && word.anim_groups.length > 0) {
            return word.anim_groups;
        }
        if (line.anim_groups && line.anim_groups.length > 0) {
            return line.anim_groups;
        }
        if (config && config.word_anim_groups && config.word_anim_groups.length > 0) {
            return config.word_anim_groups;
        }
        if (config && config.line_anim_groups && config.line_anim_groups.length > 0) {
            return config.line_anim_groups;
        }
        return [];
    }

    /**
     * 解析行级样式（从行动画组）
     * @param {number} t
     * @param {LyricLine} line
     * @param {import('../ttml/types.js').AnimationConfig} config
     * @returns {Map<string, *>}
     */
    #resolveLineStyles(t, line, config) {
        const result = new Map();

        // 行动画组优先级：行自身 > 全局行动画组
        let anim_groups = [];
        if (line.anim_groups && line.anim_groups.length > 0) {
            anim_groups = line.anim_groups;
        } else if (config && config.line_anim_groups) {
            anim_groups = config.line_anim_groups;
        }

        // 评估每个动画组
        // 使用行的第一个字作为锚点参考（行级属性如 textAlign 不依赖具体字）
        const ref_word = line.words[0] || { start_time: line.start_time, end_time: line.end_time };

        for (const group of anim_groups) {
            // 计算时间窗口
            const start = this.#resolveLineTime(group.start, line, ref_word);
            const end = this.#resolveLineTime(group.end, line, ref_word);

            if (t < start || t > end) continue;

            const duration = end - start;
            if (duration <= 0 && start !== -Infinity && end !== Infinity) continue;

            // 计算进度（无限时间窗口时 progress = 0.5，保持稳定值）
            let progress = 0.5;
            if (start !== -Infinity && end !== Infinity && duration > 0) {
                progress = (t - start) / duration;
            }

            // 评估每个通道
            for (const channel of group.channels) {
                const channel_def = getChannel(channel.channel_id);
                if (!channel_def) continue;

                const eased_progress = evaluateEasing(channel.curve, progress);
                const value = channel_def.lerp(channel.from, channel.to, eased_progress);
                result.set(channel.channel_id, value);
            }
        }

        return result;
    }

    /**
     * 解析行级时间锚点
     * @param {import('../ttml/types.js').TimeAnchor} anchor
     * @param {LyricLine} line
     * @param {LyricWord} ref_word
     * @returns {number}
     */
    #resolveLineTime(anchor, line, ref_word) {
        const base_times = {
            wordStart: ref_word.start_time,
            wordEnd: ref_word.end_time,
            lineStart: line.start_time,
            lineEnd: line.end_time,
        };
        const base = base_times[anchor.ref] || 0;

        if (anchor.offset === null) {
            return anchor.dir === "before" ? -Infinity : Infinity;
        }
        if (anchor.offset === Infinity) return Infinity;
        if (anchor.offset === -Infinity) return -Infinity;

        return anchor.dir === "before" ? base - anchor.offset : base + anchor.offset;
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        clear(this.#container);
        this.#canvas = null;
        this.#project = null;
        this.#wordElements = [];
        this.#lineElements = [];
    }
}

/**
 * 动画渲染器
 * 字幕模式：所有歌词行在同一个固定位置依次出现和消失，
 * 不滚动，不偏移，如同电视节目字幕
 */

import { bus } from "../utils/events.js";
import { h, clear } from "../utils/dom.js";
import { resolveWord, computeTimeWindow } from "./resolver.js";
import { applyChannel } from "./channels.js";

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
            }
        });
        bus.on("audio:timeupdate", ({ currentTime }) => this.updateTime(currentTime));
        bus.on("audio:seeked", ({ currentTime }) => this.updateTime(currentTime));
    }

    /**
     * 加载项目数据，重建 DOM
     * @param {ProjectData} project
     */
    load(project) {
        this.#project = project;
        this.#wordElements = [];

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
                word_el.style.fontFamily = "system-ui, -apple-system, sans-serif";
                word_el.style.fontSize = "32px";
                word_el.style.color = "#ffffff";
                word_el.style.textShadow = "none";
                word_el.style.webkitTextStroke = "none";
                line_el.appendChild(word_el);
                word_els.push(word_el);
            }

            this.#canvas.appendChild(line_el);
            this.#wordElements.push(word_els);
        }

        this.#container.appendChild(this.#canvas);

        // 初始化：所有行/字隐藏，避免全部堆积在画布中
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

        // 字幕模式：仅显示当前时间所在的行，其余行全部隐藏
        for (let line_idx = 0; line_idx < lyrics.length; line_idx++) {
            const line = lyrics[line_idx];
            const word_els = this.#wordElements[line_idx];
            const line_el = word_els.length > 0 ? word_els[0].parentElement : null;

            // 判断行是否在有效时间范围内
            const in_line_range = t >= line.start_time && t < line.end_time;

            if (!in_line_range) {
                if (line_el) line_el.classList.add("hidden");
                continue;
            }

            // 行在有效时间内，显示
            if (line_el) line_el.classList.remove("hidden");

            // 逐字处理
            for (let word_idx = 0; word_idx < line.words.length; word_idx++) {
                const word = line.words[word_idx];
                const word_el = word_els[word_idx];
                const time_window = computeTimeWindow(word, line, word.anim_groups || []);

                if (t < time_window.start || t > time_window.end) {
                    word_el.classList.add("hidden");
                    continue;
                }

                word_el.classList.remove("hidden");

                const styles = resolveWord(t, line, word, config);
                for (const [channel_id, value] of styles) {
                    applyChannel(word_el, channel_id, value);
                }
            }
        }
    }

    /**
     * 销毁渲染器
     */
    destroy() {
        clear(this.#container);
        this.#canvas = null;
        this.#project = null;
        this.#wordElements = [];
    }
}

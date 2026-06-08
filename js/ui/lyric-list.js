/**
 * 歌词列表组件
 * 显示解析后的歌词行，支持点击选择和视觉反馈
 */

import { bus } from "../utils/events.js";
import { h, clear, cls } from "../utils/dom.js";
import { msToTimestamp } from "../utils/time.js";

/**
 * 初始化歌词列表
 * @param {HTMLElement} container - 歌词列表容器元素
 */
export function initLyricList(container) {
    /** @type {import("../ttml/types.js").ProjectData | null} */
    let project = null;
    /** @type {string | null} */
    let selected_line_id = null;
    /** @type {number} */
    let selected_word_index = -1;

    /** 当前播放位置（毫秒），用于高亮正在唱的行/字 */
    let current_time = 0;
    /** 当前正在播放的行 ID 集合（支持多行同时高亮） */
    let playing_line_ids = new Set();
    /** 当前正在播放的字：Map<lineId, wordIndex> */
    let playing_words = new Map();

    /**
     * 渲染所有歌词行
     */
    function render() {
        clear(container);
        if (!project || project.lyrics.length === 0) {
            container.appendChild(
                h("div", { className: "empty-hint" }, "暂无歌词，请导入 TTML 文件"),
            );
            return;
        }

        for (const line of project.lyrics) {
            const row = renderLine(line);
            container.appendChild(row);
        }
    }

    /**
     * 渲染单行歌词
     * @param {import("../ttml/types.js").LyricLine} line
     * @returns {HTMLElement}
     */
    function renderLine(line) {
        const is_selected = line.id === selected_line_id;
        const is_playing = playing_line_ids.has(line.id);

        // 时间范围
        const time_str = `${msToTimestamp(line.start_time, { ms: false })} → ${msToTimestamp(line.end_time, { ms: false })}`;

        // 歌词文本（逐词拼接，带选中状态和点击事件）
        const words_html = line.words
            .map((w, wi) => {
                const has_style = w.style && (w.style.scale || w.style.color || w.style.bold);
                const is_word_selected = is_selected && wi === selected_word_index;
                const is_word_playing = is_playing && wi === playing_words.get(line.id);
                let word_class = "word-tag";
                if (has_style) word_class += " styled";
                if (is_word_selected) word_class += " word-selected";
                if (is_word_playing) word_class += " word-playing";
                return `<span class="${word_class}" title="${msToTimestamp(w.start_time)} → ${msToTimestamp(w.end_time)}" data-word-index="${wi}">${esc(w.word)}</span>`;
            })
            .join("");

        // 元数据标签
        const tags = [];
        if (line.is_duet) tags.push(h("span", { className: "tag duet" }, "对唱"));
        if (line.is_background) tags.push(h("span", { className: "tag bg" }, "背景"));
        if (line.translated_lyric) tags.push(h("span", { className: "tag trans" }, "译"));
        if (line.roman_lyric) tags.push(h("span", { className: "tag roman" }, "音"));
        if (line.style) tags.push(h("span", { className: "tag style" }, "样式"));

        const row = h("div", {
            className: cls("lyric-row", is_selected && "selected", is_playing && "playing"),
            "data-line-id": line.id,
        });

        row.innerHTML = `
            <span class="row-index">${line.id}</span>
            <span class="row-time">${time_str}</span>
            <span class="row-words">${words_html}</span>
            <span class="row-meta"></span>
        `;

        // 逐词点击选择/取消
        const word_spans = row.querySelectorAll(".word-tag");
        word_spans.forEach((span, wi) => {
            span.addEventListener("click", (e) => {
                handleWordClick(e, line, wi);
            });
            // 双击词 → 跳转到该词开始时间
            span.addEventListener("dblclick", (e) => {
                e.stopPropagation();
                bus.emit("ui:seek", { time: line.words[wi].start_time });
            });
        });

        const meta_el = row.querySelector(".row-meta");
        for (const tag of tags) meta_el.appendChild(tag);

        // 翻译提示（hover 显示）
        if (line.translated_lyric) {
            row.title = `翻译: ${line.translated_lyric}`;
        }

        // 双击行 → 跳转到该行开始时间
        row.addEventListener("dblclick", (e) => {
            e.stopPropagation();
            bus.emit("ui:seek", { time: line.start_time });
        });

        row.addEventListener("click", () => {
            // 清除词汇选中状态
            if (selected_word_index >= 0 && selected_line_id) {
                const prev_row = container.querySelector(`.lyric-row[data-line-id="${selected_line_id}"]`);
                if (prev_row) {
                    const prev_words = prev_row.querySelectorAll(".word-tag");
                    if (prev_words[selected_word_index]) prev_words[selected_word_index].classList.remove("word-selected");
                }
            }
            selected_word_index = -1;

            // 点击已选中的行 → 取消选择
            if (selected_line_id === line.id) {
                selected_line_id = null;
                row.classList.remove("selected");
                bus.emit("ui:selectLine", { lineId: null, line: null });
                return;
            }

            // 取消之前的选择
            const prev = container.querySelector(".lyric-row.selected");
            if (prev) prev.classList.remove("selected");

            // 选择当前行
            selected_line_id = line.id;
            row.classList.add("selected");
            bus.emit("ui:selectLine", { lineId: line.id, line });
        });

        return row;
    }

    /**
     * 处理逐词点击选择/取消
     */
    function handleWordClick(e, line, word_index) {
        e.stopPropagation();
        const word = line.words[word_index];

        // 点击已选中的词 → 取消选择
        if (selected_line_id === line.id && selected_word_index === word_index) {
            selected_word_index = -1;
            e.currentTarget.classList.remove("word-selected");
            bus.emit("ui:selectWord", { lineId: null, line: null, wordIndex: null, word: null });
            return;
        }

        // 清除之前词汇的选中样式
        if (selected_word_index >= 0 && selected_line_id) {
            const prev_row = container.querySelector(`.lyric-row[data-line-id="${selected_line_id}"]`);
            if (prev_row) {
                const prev_words = prev_row.querySelectorAll(".word-tag");
                if (prev_words[selected_word_index]) prev_words[selected_word_index].classList.remove("word-selected");
            }
        }

        // 如果点击不同行，先选中该行
        if (selected_line_id !== line.id) {
            const prev = container.querySelector(".lyric-row.selected");
            if (prev) prev.classList.remove("selected");
            selected_line_id = line.id;
            const row = container.querySelector(`.lyric-row[data-line-id="${line.id}"]`);
            if (row) row.classList.add("selected");
            bus.emit("ui:selectLine", { lineId: line.id, line });
        }

        // 选中当前词
        selected_word_index = word_index;
        e.currentTarget.classList.add("word-selected");
        bus.emit("ui:selectWord", { lineId: line.id, line, wordIndex: word_index, word });
    }

    // ---- 播放高亮 ----

    /**
     * 根据当前播放时间更新高亮状态（支持多行同时高亮，增量更新 DOM class）
     */
    function updatePlayingHighlight(time) {
        if (!project || project.lyrics.length === 0) return;

        // 收集当前时间点所有正在播放的行和字
        const new_line_ids = new Set();
        const new_words = new Map();

        for (const line of project.lyrics) {
            if (time >= line.start_time && time < line.end_time) {
                new_line_ids.add(line.id);
                for (let wi = 0; wi < line.words.length; wi++) {
                    const w = line.words[wi];
                    if (time >= w.start_time && time < w.end_time) {
                        new_words.set(line.id, wi);
                        break;
                    }
                }
            }
        }

        // 快速检查：行和字都没变化则跳过
        if (setsEqual(playing_line_ids, new_line_ids) && mapsEqual(playing_words, new_words)) {
            return;
        }

        // 移除不再播放的行
        for (const id of playing_line_ids) {
            if (!new_line_ids.has(id)) {
                const el = container.querySelector(`.lyric-row[data-line-id="${id}"].playing`);
                if (el) el.classList.remove("playing");
            }
        }
        // 添加新播放的行
        for (const id of new_line_ids) {
            if (!playing_line_ids.has(id)) {
                const el = container.querySelector(`.lyric-row[data-line-id="${id}"]`);
                if (el) el.classList.add("playing");
            }
        }

        // 移除不再播放的字
        for (const [lid, wi] of playing_words) {
            if (new_words.get(lid) !== wi) {
                const row = container.querySelector(`.lyric-row[data-line-id="${lid}"]`);
                if (row) {
                    const words = row.querySelectorAll(".word-tag");
                    if (words[wi]) words[wi].classList.remove("word-playing");
                }
            }
        }
        // 添加新播放的字
        for (const [lid, wi] of new_words) {
            if (playing_words.get(lid) !== wi) {
                const row = container.querySelector(`.lyric-row[data-line-id="${lid}"]`);
                if (row) {
                    const words = row.querySelectorAll(".word-tag");
                    if (words[wi]) words[wi].classList.add("word-playing");
                }
            }
        }

        playing_line_ids = new_line_ids;
        playing_words = new_words;
    }

    /** 比较两个 Set 是否内容相同 */
    function setsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (const v of a) if (!b.has(v)) return false;
        return true;
    }

    /** 比较两个 Map 是否内容相同 */
    function mapsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (const [k, v] of a) if (b.get(k) !== v) return false;
        return true;
    }

    // ---- 事件监听 ----
    bus.on("lyrics:loaded", (proj) => {
        project = proj;
        selected_line_id = null;
        selected_word_index = -1;
        playing_line_ids = new Set();
        playing_words = new Map();
        current_time = 0;
        render();
    });

    bus.on("lyrics:modified", (proj) => {
        project = proj;
        render();
    });

    bus.on("audio:timeupdate", ({ currentTime }) => {
        current_time = currentTime;
        updatePlayingHighlight(currentTime);
    });

    bus.on("audio:seeked", ({ currentTime }) => {
        current_time = currentTime;
        updatePlayingHighlight(currentTime);
    });
}

function esc(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

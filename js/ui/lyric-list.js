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

        // 时间范围
        const time_str = `${msToTimestamp(line.start_time, { ms: false })} → ${msToTimestamp(line.end_time, { ms: false })}`;

        // 歌词文本（逐词拼接）
        const words_html = line.words
            .map((w) => {
                const has_style = w.style && (w.style.scale || w.style.color || w.style.bold);
                const c = has_style ? "word-tag styled" : "word-tag";
                return `<span class="${c}" title="${msToTimestamp(w.start_time)} → ${msToTimestamp(w.end_time)}">${esc(w.word)}</span>`;
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
            className: cls("lyric-row", is_selected && "selected"),
            "data-line-id": line.id,
        });

        row.innerHTML = `
            <span class="row-index">${line.id}</span>
            <span class="row-time">${time_str}</span>
            <span class="row-words">${words_html}</span>
            <span class="row-meta"></span>
        `;

        const meta_el = row.querySelector(".row-meta");
        for (const tag of tags) meta_el.appendChild(tag);

        // 翻译提示（hover 显示）
        if (line.translated_lyric) {
            row.title = `翻译: ${line.translated_lyric}`;
        }

        row.addEventListener("click", () => {
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

    // ---- 事件监听 ----
    bus.on("lyrics:loaded", (proj) => {
        project = proj;
        selected_line_id = null;
        render();
    });

    bus.on("lyrics:modified", (proj) => {
        project = proj;
        render();
    });
}

function esc(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

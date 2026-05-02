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
	let selectedLineId = null;

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
		const isSelected = line.id === selectedLineId;

		// 时间范围
		const timeStr = `${msToTimestamp(line.startTime, { ms: false })} → ${msToTimestamp(line.endTime, { ms: false })}`;

		// 歌词文本（逐词拼接）
		const wordsHtml = line.words
			.map((w) => {
				const hasStyle = w.style && (w.style.scale || w.style.color || w.style.bold);
				const cls = hasStyle ? "word-tag styled" : "word-tag";
				return `<span class="${cls}" title="${msToTimestamp(w.startTime)} → ${msToTimestamp(w.endTime)}">${esc(w.word)}</span>`;
			})
			.join("");

		// 元数据标签
		const tags = [];
		if (line.isDuet) tags.push(h("span", { className: "tag duet" }, "对唱"));
		if (line.isBackground) tags.push(h("span", { className: "tag bg" }, "背景"));
		if (line.translatedLyric) tags.push(h("span", { className: "tag trans" }, "译"));
		if (line.romanLyric) tags.push(h("span", { className: "tag roman" }, "音"));
		if (line.style) tags.push(h("span", { className: "tag style" }, "样式"));

		const row = h("div", {
			className: cls("lyric-row", isSelected && "selected"),
			"data-line-id": line.id,
		});

		row.innerHTML = `
			<span class="row-index">${line.id}</span>
			<span class="row-time">${timeStr}</span>
			<span class="row-words">${wordsHtml}</span>
			<span class="row-meta"></span>
		`;

		const metaEl = row.querySelector(".row-meta");
		for (const tag of tags) metaEl.appendChild(tag);

		// 翻译提示（hover 显示）
		if (line.translatedLyric) {
			row.title = `翻译: ${line.translatedLyric}`;
		}

		row.addEventListener("click", () => {
			// 取消之前的选择
			const prev = container.querySelector(".lyric-row.selected");
			if (prev) prev.classList.remove("selected");

			// 选择当前行
			selectedLineId = line.id;
			row.classList.add("selected");
			bus.emit("ui:selectLine", { lineId: line.id, line });
		});

		return row;
	}

	// ---- 事件监听 ----
	bus.on("lyrics:loaded", (proj) => {
		project = proj;
		selectedLineId = null;
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

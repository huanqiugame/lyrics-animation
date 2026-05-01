/**
 * TTML 歌词解析器
 * 将 TTML XML 字符串解析为内部 ProjectData 数据模型
 * 纯函数，仅依赖浏览器原生 DOMParser API + time.js
 */

import { parseTimespan } from "../utils/time.js";
import { createLyricLine, createLyricWord, createEmptyProject } from "./types.js";

/**
 * 获取元素的本地名称（去掉命名空间前缀）
 * @param {Element} el
 * @returns {string}
 */
function localName(el) {
	return el.localName || el.tagName.split(":").pop() || el.tagName;
}

/**
 * 获取属性值，兼容有无命名空间前缀
 * @param {Element} el
 * @param {string} target - 不含前缀的属性名
 * @returns {string|null}
 */
function getAttr(el, target) {
	const direct = el.getAttribute(target);
	if (direct !== null) return direct;
	for (const attr of el.attributes) {
		if (attr.localName === target || attr.name.endsWith(`:${target}`)) {
			return attr.value;
		}
	}
	return null;
}

/**
 * 从 span 元素创建 LyricWord
 * @param {Element} wordEl - span 元素
 * @param {number} defaultStart - 默认开始时间（用于 text node 单词）
 * @param {number} defaultEnd - 默认结束时间
 * @returns {object|null} LyricWord 或 null
 */
function wordFromElement(wordEl, defaultStart, defaultEnd) {
	let begin = getAttr(wordEl, "begin");
	let end = getAttr(wordEl, "end");

	const text = wordEl.textContent ?? "";

	// 无 begin/end 的 span 不是真正的单词（可能是翻译、音译等 role span）
	if (!begin || !end) {
		return null;
	}

	const word = createLyricWord(text, parseTimespan(begin), parseTimespan(end));

	// 提取自定义样式属性
	const style = {};
	const scale = getAttr(wordEl, "lv:scale");
	if (scale !== null) style.scale = Number(scale);
	const color = getAttr(wordEl, "lv:color");
	if (color !== null) style.color = color;
	const bold = getAttr(wordEl, "lv:bold");
	if (bold !== null) style.bold = bold === "true";

	if (Object.keys(style).length > 0) {
		word.style = style;
	}

	return word;
}

/**
 * 解析 TTML 字符串
 * @param {string} ttmlText - TTML XML 文本
 * @returns {import("./types.js").ProjectData}
 */
export function parseTTML(ttmlText) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(ttmlText, "application/xml");

	// 检查解析错误
	const parseError = doc.querySelector("parsererror");
	if (parseError) {
		throw new Error(`TTML 解析失败：${parseError.textContent}`);
	}

	const project = createEmptyProject();

	// 找到主 agent ID（type="person" 的 ttm:agent）
	let mainAgentId = "v1";
	for (const agent of doc.querySelectorAll("ttm\\:agent")) {
		if (agent.getAttribute("type") === "person") {
			const id = agent.getAttribute("xml:id");
			if (id) {
				mainAgentId = id;
				break;
			}
		}
	}

	// 解析每一行 <p>
	const lineElements = doc.querySelectorAll("body p");
	for (const lineEl of lineElements) {
		// 必须有 begin 和 end 属性
		const beginAttr = getAttr(lineEl, "begin");
		const endAttr = getAttr(lineEl, "end");
		if (!beginAttr || !endAttr) continue;

		const line = createLyricLine();
		line.id = getAttr(lineEl, "itunes:key") || `L_${project.lyrics.length}`;
		line.startTime = parseTimespan(beginAttr);
		line.endTime = parseTimespan(endAttr);

		// 对唱检测
		const agent = getAttr(lineEl, "ttm:agent");
		line.isDuet = !!agent && agent !== mainAgentId;

		// 遍历子节点：span（单词）、role span（翻译/音译）、text node（空格）
		for (const child of lineEl.childNodes) {
			if (child.nodeType === Node.TEXT_NODE) {
				// 空格文本节点 → 创建空白占位词，但继承行的时间
				const text = child.textContent ?? "";
				if (text.trim().length === 0) continue; // 纯空格跳过
				// 非空文本节点（不应出现但做兼容）
				const word = createLyricWord(text, line.startTime, line.endTime);
				line.words.push(word);
				continue;
			}

			if (child.nodeType !== Node.ELEMENT_NODE) continue;
			const el = /** @type {Element} */ (child);

			if (localName(el) !== "span") continue;

			const role = getAttr(el, "ttm:role");
			if (role === "x-translation") {
				line.translatedLyric = (el.textContent ?? "").trim();
			} else if (role === "x-roman") {
				line.romanLyric = (el.textContent ?? "").trim();
			} else {
				// 普通单词 span
				const word = wordFromElement(el, line.startTime, line.endTime);
				if (word) {
					line.words.push(word);
				}
			}
		}

		// 如果整行没有单词，跳过（可能是空行/分隔行）
		// 如果行时间未从 span 推导，需要使用 p 级别的 begin/end
		if (line.words.length === 0 && !line.translatedLyric) {
			continue;
		}

		project.lyrics.push(line);
	}

	return project;
}

/**
 * TTML 歌词解析器
 * 将 TTML XML 字符串解析为内部 ProjectData 数据模型
 * 纯函数，仅依赖浏览器原生 DOMParser API + time.js
 *
 * 支持：
 * - 逐词时间码、对唱、翻译/音译、lv: 自定义样式
 * - 多 agent（含背景人声 type="other"/"group"）
 * - <styling> 样式块 + style="id" 引用
 * - <region> 布局区域 + region="id" 关联
 * - <div> 段落分组
 * - ttm:title / xml:lang 元数据
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
 * 从 span 元素创建 LyricWord（含 lv: 样式 + styleRef）
 * @param {Element} wordEl - span 元素
 * @returns {import("./types.js").LyricWord|null}
 */
function wordFromElement(wordEl) {
	const begin = getAttr(wordEl, "begin");
	const end = getAttr(wordEl, "end");
	if (!begin || !end) return null;

	const text = wordEl.textContent ?? "";
	const word = createLyricWord(text, parseTimespan(begin), parseTimespan(end));

	// style 引用
	const styleRef = getAttr(wordEl, "style");
	if (styleRef) word.styleRef = styleRef;

	// lv: 自定义样式属性
	const style = {};
	const scale = getAttr(wordEl, "lv:scale");
	if (scale !== null) style.scale = Number(scale);
	const color = getAttr(wordEl, "lv:color");
	if (color !== null) style.color = color;
	const bold = getAttr(wordEl, "lv:bold");
	if (bold !== null) style.bold = bold === "true";

	if (Object.keys(style).length > 0) word.style = style;

	return word;
}

// ---- 新辅助解析函数 ----

/**
 * 解析 <ttm:agent> 元素
 * @param {Document} doc
 * @returns {import("./types.js").AgentInfo[]}
 */
function parseAgents(doc) {
	/** @type {import("./types.js").AgentInfo[]} */
	const agents = [];
	for (const el of doc.querySelectorAll("ttm\\:agent")) {
		const id = el.getAttribute("xml:id");
		const type = el.getAttribute("type") || "person";
		const nameEl = el.querySelector("ttm\\:name");
		const name = nameEl ? (nameEl.textContent ?? "").trim() : "";
		if (id) agents.push({ id, type, name });
	}
	return agents;
}

/**
 * 解析 <styling> 块中的 <style> 元素
 * @param {Document} doc
 * @returns {Record<string, import("./types.js").TtmlStyle>}
 */
function parseStyles(doc) {
	/** @type {Record<string, import("./types.js").TtmlStyle>} */
	const styles = {};
	const styleElements = doc.querySelectorAll("styling style");
	for (const el of styleElements) {
		const id = el.getAttribute("xml:id");
		if (!id) continue;

		/** @type {Record<string, string>} */
		const properties = {};
		for (const attr of el.attributes) {
			// 收集 tts: 开头的样式属性
			if (attr.name.startsWith("tts:") || attr.localName && attr.name.includes(":") && attr.localName !== "id") {
				const key = attr.localName || attr.name.split(":").pop();
				if (key && key !== "id") {
					properties[key] = attr.value;
				}
			}
			// 也处理无命名空间的直接属性名
			if (attr.name === "fontFamily" || attr.name === "fontSize" ||
			    attr.name === "color" || attr.name === "fontWeight" ||
			    attr.name === "fontStyle" || attr.name === "backgroundColor" ||
			    attr.name === "textAlign" || attr.name === "opacity") {
				properties[attr.name] = attr.value;
			}
		}
		if (Object.keys(properties).length > 0) {
			styles[id] = { id, properties };
		}
	}
	return styles;
}

/**
 * 解析 <layout> 块中的 <region> 元素
 * @param {Document} doc
 * @returns {Record<string, import("./types.js").RegionInfo>}
 */
function parseRegions(doc) {
	/** @type {Record<string, import("./types.js").RegionInfo>} */
	const regions = {};
	const regionElements = doc.querySelectorAll("layout region");
	for (const el of regionElements) {
		const id = el.getAttribute("xml:id");
		if (!id) continue;
		regions[id] = {
			id,
			origin: getAttr(el, "origin") || "",
			extent: getAttr(el, "extent") || "",
			textAlign: getAttr(el, "textAlign") || "",
			displayAlign: getAttr(el, "displayAlign") || "",
			styleRef: el.getAttribute("style") || null,
		};
	}
	return regions;
}

/**
 * 解析 TTML 字符串
 * @param {string} ttmlText - TTML XML 文本
 * @returns {import("./types.js").ProjectData}
 */
export function parseTTML(ttmlText) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(ttmlText, "application/xml");

	const parseError = doc.querySelector("parsererror");
	if (parseError) {
		throw new Error(`TTML 解析失败：${parseError.textContent}`);
	}

	const project = createEmptyProject();

	// 元数据
	project.lang = doc.documentElement.getAttribute("xml:lang") || "en-US";
	const titleEl = doc.querySelector("ttm\\:title");
	if (titleEl) project.title = (titleEl.textContent ?? "").trim();

	// 解析 head 中的结构化数据
	project.agents = parseAgents(doc);
	project.styles = parseStyles(doc);
	project.regions = parseRegions(doc);

	// 确定主 agent：第一个 type="person" 的 agent
	let mainAgentId = "v1";
	for (const agent of project.agents) {
		if (agent.type === "person") {
			mainAgentId = agent.id;
			break;
		}
	}
	// 如果没有声明任何 agent，用 "v1" 兜底
	if (project.agents.length === 0) {
		project.agents.push({ id: "v1", type: "person", name: "" });
	}

	/**
	 * 根据 agent id 查找 agent 信息
	 * @param {string} agentId
	 * @returns {import("./types.js").AgentInfo|undefined}
	 */
	function findAgent(agentId) {
		return project.agents.find((a) => a.id === agentId);
	}

	// 遍历所有 <div>，每个 div 下有多个 <p>
	const divElements = doc.querySelectorAll("body div");
	const containers = divElements.length > 0 ? divElements : [doc.querySelector("body")];

	for (const container of containers) {
		if (!container) continue;

		// 提取容器的 region 属性（<div region="...">）
		const containerRegion = container.getAttribute("region");

		// 获取容器内的 <p> 元素（body 下直接用 querySelectorAll("p")，div 下用 children）
		const lineElements = container.tagName === "div"
			? container.querySelectorAll(":scope > p")
			: container.querySelectorAll("p");

		for (const lineEl of lineElements) {
			const beginAttr = getAttr(lineEl, "begin");
			const endAttr = getAttr(lineEl, "end");
			if (!beginAttr || !endAttr) continue;

			const line = createLyricLine();
			line.id = getAttr(lineEl, "itunes:key") || `L_${project.lyrics.length}`;
			line.startTime = parseTimespan(beginAttr);
			line.endTime = parseTimespan(endAttr);

			// agent 归属
			const agentId = getAttr(lineEl, "ttm:agent") || mainAgentId;
			line.agentId = agentId;

			const agent = findAgent(agentId);
			line.isDuet = agentId !== mainAgentId && (!agent || agent.type === "person");
			line.isBackground = !!agent && agent.type !== "person";

			// style 引用
			const styleRef = getAttr(lineEl, "style");
			if (styleRef) line.styleRef = styleRef;

			// region 归属（行级 region 覆盖容器级）
			const lineRegion = lineEl.getAttribute("region") || containerRegion;
			if (lineRegion) line.regionId = lineRegion;

			// 逐行 lv: 样式覆盖
			const lineStyle = {};
			const lScale = getAttr(lineEl, "lv:scale");
			if (lScale !== null) lineStyle.scale = Number(lScale);
			const lColor = getAttr(lineEl, "lv:color");
			if (lColor !== null) lineStyle.color = lColor;
			if (Object.keys(lineStyle).length > 0) line.style = lineStyle;

			// 遍历子节点
			for (const child of lineEl.childNodes) {
				if (child.nodeType === Node.TEXT_NODE) {
					const text = child.textContent ?? "";
					if (text.trim().length === 0) continue;
					const w = createLyricWord(text, line.startTime, line.endTime);
					line.words.push(w);
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
					const word = wordFromElement(el);
					if (word) line.words.push(word);
				}
			}

			if (line.words.length === 0 && !line.translatedLyric) continue;
			project.lyrics.push(line);
		}
	}

	return project;
}

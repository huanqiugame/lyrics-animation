/**
 * TTML 歌词生成器
 * 将内部 ProjectData 数据模型序列化为 TTML XML 字符串
 * 纯函数，仅依赖浏览器原生 DOM API + time.js
 * 不输出 AnimationConfig（那是独立 JSON）
 */

import { msToTimestamp } from "../utils/time.js";

/** TTML 命名空间 */
const NS = {
	tt: "http://www.w3.org/ns/ttml",
	ttm: "http://www.w3.org/ns/ttml#metadata",
	tts: "http://www.w3.org/ns/ttml#styling",
	amll: "http://www.example.com/ns/amll",
	itunes: "http://music.apple.com/lyric-ttml-internal",
	lv: "http://www.example.com/ns/lyric-vfx",
};

/**
 * 将内部数据模型序列化为 TTML XML 字符串
 * @param {import("./types.js").ProjectData} project
 * @returns {string}
 */
export function writeTTML(project) {
	const { lyrics } = project;
	const doc = new Document();

	// ---- 辅助函数 ----

	/**
	 * 为单词创建 span 元素
	 * @param {import("./types.js").LyricWord} word
	 * @returns {Element}
	 */
	function createWordSpan(word) {
		const span = doc.createElement("span");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		span.textContent = word.word;

		// style 引用
		if (word.styleRef) {
			span.setAttribute("style", word.styleRef);
		}

		// lv: 自定义样式覆盖
		if (word.style) {
			if (word.style.scale !== undefined) {
				span.setAttribute("lv:scale", String(word.style.scale));
			}
			if (word.style.color !== undefined) {
				span.setAttribute("lv:color", word.style.color);
			}
			if (word.style.bold !== undefined) {
				span.setAttribute("lv:bold", word.style.bold ? "true" : "false");
			}
		}

		return span;
	}

	/**
	 * 判断是否为动态歌词（有逐词时间）
	 */
	function isDynamicLyric() {
		return lyrics.some(
			(line) => line.words.filter((w) => w.word.trim().length > 0).length > 1,
		);
	}

	/**
	 * 按 regionId 将歌词行分组，用于 div 输出
	 * @returns {Array<{regionId: string|null, lines: import("./types.js").LyricLine[]}>}
	 */
	function groupByRegion() {
		/** @type {Array<{regionId: string|null, lines: import("./types.js").LyricLine[]}>} */
		const groups = [];
		for (const line of lyrics) {
			const last = groups[groups.length - 1];
			if (last && last.regionId === (line.regionId || null)) {
				last.lines.push(line);
			} else {
				groups.push({ regionId: line.regionId || null, lines: [line] });
			}
		}
		return groups;
	}

	// ---- 构建文档 ----

	const ttRoot = doc.createElement("tt");
	ttRoot.setAttribute("xmlns", NS.tt);
	ttRoot.setAttribute("xmlns:ttm", NS.ttm);
	ttRoot.setAttribute("xmlns:tts", NS.tts);
	ttRoot.setAttribute("xmlns:amll", NS.amll);
	ttRoot.setAttribute("xmlns:itunes", NS.itunes);
	ttRoot.setAttribute("xmlns:lv", NS.lv);
	ttRoot.setAttribute("xml:lang", project.lang || "en-US");
	ttRoot.setAttribute("itunes:timing", isDynamicLyric() ? "Word" : "Line");
	doc.appendChild(ttRoot);

	// ---- Head + Metadata ----
	const head = doc.createElement("head");
	const metadata = doc.createElement("metadata");

	// 标题
	if (project.title) {
		const titleEl = doc.createElement("ttm:title");
		titleEl.textContent = project.title;
		metadata.appendChild(titleEl);
	}

	// agent 声明
	for (const agent of project.agents) {
		const agentEl = doc.createElement("ttm:agent");
		agentEl.setAttribute("type", agent.type);
		agentEl.setAttribute("xml:id", agent.id);
		if (agent.name) {
			const nameEl = doc.createElement("ttm:name");
			nameEl.setAttribute("type", "full");
			nameEl.textContent = agent.name;
			agentEl.appendChild(nameEl);
		}
		metadata.appendChild(agentEl);
	}

	// 如果没有声明任何 agent，添加默认的 v1
	if (project.agents.length === 0) {
		const defaultAgent = doc.createElement("ttm:agent");
		defaultAgent.setAttribute("type", "person");
		defaultAgent.setAttribute("xml:id", "v1");
		metadata.appendChild(defaultAgent);
	}

	head.appendChild(metadata);

	// ---- Styling ----
	const styleIds = Object.keys(project.styles);
	if (styleIds.length > 0) {
		const styling = doc.createElement("styling");
		for (const sid of styleIds) {
			const s = project.styles[sid];
			const styleEl = doc.createElement("style");
			styleEl.setAttribute("xml:id", s.id);
			for (const [key, value] of Object.entries(s.properties)) {
				styleEl.setAttribute(`tts:${key}`, value);
			}
			styling.appendChild(styleEl);
		}
		head.appendChild(styling);
	}

	// ---- Layout ----
	const regionIds = Object.keys(project.regions);
	if (regionIds.length > 0) {
		const layout = doc.createElement("layout");
		for (const rid of regionIds) {
			const r = project.regions[rid];
			const regionEl = doc.createElement("region");
			regionEl.setAttribute("xml:id", r.id);
			if (r.origin) regionEl.setAttribute("tts:origin", r.origin);
			if (r.extent) regionEl.setAttribute("tts:extent", r.extent);
			if (r.textAlign) regionEl.setAttribute("tts:textAlign", r.textAlign);
			if (r.displayAlign) regionEl.setAttribute("tts:displayAlign", r.displayAlign);
			if (r.styleRef) regionEl.setAttribute("style", r.styleRef);
			layout.appendChild(regionEl);
		}
		head.appendChild(layout);
	}

	ttRoot.appendChild(head);

	// ---- Body ----
	const body = doc.createElement("body");
	const totalDuration = lyrics.length > 0
		? Math.max(...lyrics.map((l) => l.endTime))
		: 0;
	body.setAttribute("dur", msToTimestamp(totalDuration));

	const dynamic = isDynamicLyric();
	const groups = groupByRegion();

	for (const group of groups) {
		const div = doc.createElement("div");
		if (group.regionId) {
			div.setAttribute("region", group.regionId);
		}
		if (group.lines.length > 0) {
			div.setAttribute("begin", msToTimestamp(group.lines[0].startTime));
			div.setAttribute("end", msToTimestamp(group.lines[group.lines.length - 1].endTime));
		}

		for (const line of group.lines) {
			const p = doc.createElement("p");
			p.setAttribute("begin", msToTimestamp(line.startTime));
			p.setAttribute("end", msToTimestamp(line.endTime));
			p.setAttribute("ttm:agent", line.agentId || "v1");
			p.setAttribute("itunes:key", line.id);

			// style 引用
			if (line.styleRef) {
				p.setAttribute("style", line.styleRef);
			}

			// 行级 region（覆盖 div 的 region）
			if (line.regionId && line.regionId !== group.regionId) {
				p.setAttribute("region", line.regionId);
			}

			// lv: 行级样式覆盖
			if (line.style) {
				if (line.style.scale !== undefined) {
					p.setAttribute("lv:scale", String(line.style.scale));
				}
				if (line.style.color !== undefined) {
					p.setAttribute("lv:color", line.style.color);
				}
			}

			if (dynamic) {
				for (const word of line.words) {
					if (word.word.trim().length === 0) {
						p.appendChild(doc.createTextNode(word.word));
					} else {
						p.appendChild(createWordSpan(word));
					}
				}
			} else if (line.words.length > 0) {
				p.appendChild(createWordSpan(line.words[0]));
			}

			// 翻译
			if (line.translatedLyric) {
				const transSpan = doc.createElement("span");
				transSpan.setAttribute("ttm:role", "x-translation");
				transSpan.setAttribute("xml:lang", "zh-CN");
				transSpan.textContent = line.translatedLyric;
				p.appendChild(transSpan);
			}

			// 音译
			if (line.romanLyric) {
				const romanSpan = doc.createElement("span");
				romanSpan.setAttribute("ttm:role", "x-roman");
				romanSpan.textContent = line.romanLyric;
				p.appendChild(romanSpan);
			}

			div.appendChild(p);
		}

		body.appendChild(div);
	}

	ttRoot.appendChild(body);

	return new XMLSerializer().serializeToString(doc);
}

/**
 * 将动画配置序列化为 JSON 字符串
 * @param {import("./types.js").AnimationConfig} config
 * @returns {string}
 */
export function writeConfigJSON(config) {
	return JSON.stringify(config, null, 2);
}

/**
 * 将动画配置序列化为 JSON 并下载
 * @param {import("./types.js").AnimationConfig} config
 * @param {string} [filename="animation-config.json"]
 */
export function downloadConfig(config, filename = "animation-config.json") {
	const json = writeConfigJSON(config);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * 将 TTML 字符串下载为文件
 * @param {string} ttmlText
 * @param {string} [filename="lyric.ttml"]
 */
export function downloadTTML(ttmlText, filename = "lyric.ttml") {
	const blob = new Blob([ttmlText], { type: "application/xml" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

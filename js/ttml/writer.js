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
		const span = doc.createElementNS(NS.tt, "span");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		span.textContent = word.word;

		// 写入逐字样式覆盖
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
	 * 判断歌词是否为动态歌词（有逐词时间）
	 */
	function isDynamicLyric() {
		return lyrics.some(
			(line) => line.words.filter((w) => w.word.trim().length > 0).length > 1,
		);
	}

	// ---- 构建文档 ----

	const ttRoot = doc.createElementNS(NS.tt, "tt");
	ttRoot.setAttribute("xmlns", NS.tt);
	ttRoot.setAttribute("xmlns:ttm", NS.ttm);
	ttRoot.setAttribute("xmlns:tts", NS.tts);
	ttRoot.setAttribute("xmlns:amll", NS.amll);
	ttRoot.setAttribute("xmlns:itunes", NS.itunes);
	ttRoot.setAttribute("xmlns:lv", NS.lv);
	ttRoot.setAttribute("itunes:timing", isDynamicLyric() ? "Word" : "Line");
	doc.appendChild(ttRoot);

	// ---- Head + Metadata ----
	const head = doc.createElementNS(NS.tt, "head");
	const metadata = doc.createElementNS(NS.ttm, "metadata");

	// 主 agent
	const mainAgent = doc.createElementNS(NS.ttm, "ttm:agent");
	mainAgent.setAttribute("type", "person");
	mainAgent.setAttribute("xml:id", "v1");
	metadata.appendChild(mainAgent);

	// 对唱 agent（如果有对唱行）
	const hasDuet = lyrics.some((l) => l.isDuet);
	if (hasDuet) {
		const duetAgent = doc.createElementNS(NS.ttm, "ttm:agent");
		duetAgent.setAttribute("type", "other");
		duetAgent.setAttribute("xml:id", "v2");
		metadata.appendChild(duetAgent);
	}

	head.appendChild(metadata);
	ttRoot.appendChild(head);

	// ---- Body ----
	const body = doc.createElementNS(NS.tt, "body");
	const totalDuration = lyrics.length > 0
		? Math.max(...lyrics.map((l) => l.endTime))
		: 0;
	body.setAttribute("dur", msToTimestamp(totalDuration));

	const div = doc.createElementNS(NS.tt, "div");
	if (lyrics.length > 0) {
		div.setAttribute("begin", msToTimestamp(lyrics[0].startTime));
		div.setAttribute("end", msToTimestamp(lyrics[lyrics.length - 1].endTime));
	}

	const dynamic = isDynamicLyric();

	for (const line of lyrics) {
		const p = doc.createElementNS(NS.tt, "p");
		p.setAttribute("begin", msToTimestamp(line.startTime));
		p.setAttribute("end", msToTimestamp(line.endTime));
		p.setAttribute("ttm:agent", line.isDuet ? "v2" : "v1");
		p.setAttribute("itunes:key", line.id);

		// 写入逐行样式覆盖
		if (line.style) {
			if (line.style.scale !== undefined) {
				p.setAttribute("lv:scale", String(line.style.scale));
			}
			if (line.style.color !== undefined) {
				p.setAttribute("lv:color", line.style.color);
			}
		}

		if (dynamic) {
			// 动态歌词：每个单词都是 span
			for (const word of line.words) {
				if (word.word.trim().length === 0) {
					p.appendChild(doc.createTextNode(word.word));
				} else {
					p.appendChild(createWordSpan(word));
				}
			}
		} else {
			// 静态歌词：只有第一个单词带时间
			if (line.words.length > 0) {
				const word = line.words[0];
				p.appendChild(createWordSpan(word));
			}
		}

		// 翻译
		if (line.translatedLyric) {
			const transSpan = doc.createElementNS(NS.tt, "span");
			transSpan.setAttribute("ttm:role", "x-translation");
			transSpan.setAttribute("xml:lang", "zh-CN");
			transSpan.textContent = line.translatedLyric;
			p.appendChild(transSpan);
		}

		// 音译
		if (line.romanLyric) {
			const romanSpan = doc.createElementNS(NS.tt, "span");
			romanSpan.setAttribute("ttm:role", "x-roman");
			romanSpan.textContent = line.romanLyric;
			p.appendChild(romanSpan);
		}

		div.appendChild(p);
	}

	body.appendChild(div);
	ttRoot.appendChild(body);

	// ---- 序列化 ----
	// XMLSerializer 输出无格式单行，适合机器处理
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

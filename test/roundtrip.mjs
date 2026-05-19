/**
 * Phase 1 验证脚本：测试 parseTTML / writeTTML 双向转换
 * 用法：/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node test/roundtrip.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { parseTimespan, msToTimestamp } from '../js/utils/time.js';

// ---- 内联 parseTTML（Node.js 环境无 DOMParser from browser，需用 linkedom 或模拟） ----

// Node 24 内置了浏览器兼容的 DOMParser (在 globalThis 上)
// 如果没有，报错提示
if (typeof DOMParser === 'undefined') {
    console.error('需要 Node.js 22+ 且带 --experimental-document 标志');
    console.error('试用: node --experimental-document test/roundtrip.mjs');
    process.exit(1);
}

// ---- 从 parser.js 和 writer.js 导入 ----
// 由于 ES module 导入路径兼容问题，直接内联关键代码测试

// ======== 复制 time.js 内容（已在上面导入） ========

// ======== 复制 types.js 工厂函数 ========
function createLyricWord(word = "", startTime = 0, endTime = 0) {
    return { word, startTime, endTime, style: null };
}
function createLyricLine() {
    return { id: "", words: [], translatedLyric: "", romanLyric: "", startTime: 0, endTime: 0, isDuet: false, style: null };
}
function createEmptyProject() {
    return {
    	version: 1,
    	lyrics: [],
    	animConfig: {
    		blur: { enabled: true, startAmount: 8, endAmount: 0, duration: "word" },
    		scroll: { enabled: true, direction: "up", distance: 20, easing: "ease-out" },
    		text: { fontFamily: "sans-serif", fontSize: 48, color: "#ffffff", textShadow: "none", stroke: "none" },
    	},
    	audioFileName: null,
    };
}

// ======== 复制 parser.js 核心逻辑 ========
function localName(el) {
    return el.localName || el.tagName.split(":").pop() || el.tagName;
}
function getAttr(el, target) {
    const direct = el.getAttribute(target);
    if (direct !== null) return direct;
    for (const attr of el.attributes) {
    	if (attr.localName === target || attr.name.endsWith(`:${target}`)) return attr.value;
    }
    return null;
}

function wordFromElement(wordEl) {
    const begin = getAttr(wordEl, "begin");
    const end = getAttr(wordEl, "end");
    if (!begin || !end) return null;
    const word = createLyricWord(wordEl.textContent ?? "", parseTimespan(begin), parseTimespan(end));
    const scale = getAttr(wordEl, "lv:scale");
    if (scale !== null) word.style = { ...word.style, scale: Number(scale) };
    const color = getAttr(wordEl, "lv:color");
    if (color !== null) word.style = { ...word.style, color };
    const bold = getAttr(wordEl, "lv:bold");
    if (bold !== null) word.style = { ...word.style, bold: bold === "true" };
    return word;
}

function parseTTML(ttmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ttmlText, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) throw new Error(`TTML parse error: ${parseError.textContent}`);

    const project = createEmptyProject();
    let mainAgentId = "v1";
    for (const agent of doc.querySelectorAll("ttm\\:agent")) {
    	if (agent.getAttribute("type") === "person") {
    		const id = agent.getAttribute("xml:id");
    		if (id) { mainAgentId = id; break; }
    	}
    }

    const lineElements = doc.querySelectorAll("body p");
    for (const lineEl of lineElements) {
    	const beginAttr = getAttr(lineEl, "begin");
    	const endAttr = getAttr(lineEl, "end");
    	if (!beginAttr || !endAttr) continue;

    	const line = createLyricLine();
    	line.id = getAttr(lineEl, "itunes:key") || `L_${project.lyrics.length}`;
    	line.startTime = parseTimespan(beginAttr);
    	line.endTime = parseTimespan(endAttr);
    	const agent = getAttr(lineEl, "ttm:agent");
    	line.isDuet = !!agent && agent !== mainAgentId;

    	for (const child of lineEl.childNodes) {
    		if (child.nodeType === 3) { // TEXT_NODE
    			const text = child.textContent ?? "";
    			if (text.trim().length === 0) continue;
    			line.words.push(createLyricWord(text, line.startTime, line.endTime));
    			continue;
    		}
    		if (child.nodeType !== 1) continue; // not ELEMENT_NODE
    		const el = child;
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

    return project;
}

// ======== 复制 writer.js 核心逻辑 ========
const NS = {
    tt: "http://www.w3.org/ns/ttml",
    ttm: "http://www.w3.org/ns/ttml#metadata",
    tts: "http://www.w3.org/ns/ttml#styling",
    amll: "http://www.example.com/ns/amll",
    itunes: "http://music.apple.com/lyric-ttml-internal",
    lv: "http://www.example.com/ns/lyric-vfx",
};

function writeTTML(project) {
    const { lyrics } = project;
    const doc = new Document();

    function createWordSpan(word) {
    	const span = doc.createElement("span");
    	span.setAttribute("begin", msToTimestamp(word.startTime));
    	span.setAttribute("end", msToTimestamp(word.endTime));
    	span.textContent = word.word;
    	if (word.style) {
    		if (word.style.scale !== undefined) span.setAttribute("lv:scale", String(word.style.scale));
    		if (word.style.color !== undefined) span.setAttribute("lv:color", word.style.color);
    		if (word.style.bold !== undefined) span.setAttribute("lv:bold", word.style.bold ? "true" : "false");
    	}
    	return span;
    }

    function isDynamicLyric() {
    	return lyrics.some((line) => line.words.filter((w) => w.word.trim().length > 0).length > 1);
    }

    const ttRoot = doc.createElement("tt");
    ttRoot.setAttribute("xmlns", NS.tt);
    ttRoot.setAttribute("xmlns:ttm", NS.ttm);
    ttRoot.setAttribute("xmlns:tts", NS.tts);
    ttRoot.setAttribute("xmlns:amll", NS.amll);
    ttRoot.setAttribute("xmlns:itunes", NS.itunes);
    ttRoot.setAttribute("xmlns:lv", NS.lv);
    ttRoot.setAttribute("itunes:timing", isDynamicLyric() ? "Word" : "Line");
    doc.appendChild(ttRoot);

    const head = doc.createElement("head");
    const metadata = doc.createElement("metadata");
    const mainAgent = doc.createElement("ttm:agent");
    mainAgent.setAttribute("type", "person");
    mainAgent.setAttribute("xml:id", "v1");
    metadata.appendChild(mainAgent);

    const hasDuet = lyrics.some((l) => l.isDuet);
    if (hasDuet) {
    	const duetAgent = doc.createElement("ttm:agent");
    	duetAgent.setAttribute("type", "other");
    	duetAgent.setAttribute("xml:id", "v2");
    	metadata.appendChild(duetAgent);
    }
    head.appendChild(metadata);
    ttRoot.appendChild(head);

    const body = doc.createElement("body");
    const totalDuration = lyrics.length > 0 ? Math.max(...lyrics.map((l) => l.endTime)) : 0;
    body.setAttribute("dur", msToTimestamp(totalDuration));

    const div = doc.createElement("div");
    if (lyrics.length > 0) {
    	div.setAttribute("begin", msToTimestamp(lyrics[0].startTime));
    	div.setAttribute("end", msToTimestamp(lyrics[lyrics.length - 1].endTime));
    }

    const dynamic = isDynamicLyric();
    for (const line of lyrics) {
    	const p = doc.createElement("p");
    	p.setAttribute("begin", msToTimestamp(line.startTime));
    	p.setAttribute("end", msToTimestamp(line.endTime));
    	p.setAttribute("ttm:agent", line.isDuet ? "v2" : "v1");
    	p.setAttribute("itunes:key", line.id);

    	if (line.style) {
    		if (line.style.scale !== undefined) p.setAttribute("lv:scale", String(line.style.scale));
    		if (line.style.color !== undefined) p.setAttribute("lv:color", line.style.color);
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

    	if (line.translatedLyric) {
    		const ts = doc.createElement("span");
    		ts.setAttribute("ttm:role", "x-translation");
    		ts.setAttribute("xml:lang", "zh-CN");
    		ts.textContent = line.translatedLyric;
    		p.appendChild(ts);
    	}
    	if (line.romanLyric) {
    		const rs = doc.createElement("span");
    		rs.setAttribute("ttm:role", "x-roman");
    		rs.textContent = line.romanLyric;
    		p.appendChild(rs);
    	}

    	div.appendChild(p);
    }

    body.appendChild(div);
    ttRoot.appendChild(body);

    return new XMLSerializer().serializeToString(doc);
}

// ======== 测试 ========
console.log("=== Phase 1: TTML 解析/生成双向转换测试 ===\n");

// 1. 读取测试文件
const ttmlPath = new URL('./Helping Hands.ttml', import.meta.url).pathname;
const originalText = readFileSync(ttmlPath, 'utf8');
console.log(`1. 读取文件: ${originalText.length} 字符`);

// 2. 解析
const t0 = performance.now();
const project = parseTTML(originalText);
const t1 = performance.now();
console.log(`2. 解析完成: ${project.lyrics.length} 行, 耗时 ${(t1 - t0).toFixed(1)}ms`);

// 3. 统计信息
let totalWords = 0, duetCount = 0, transCount = 0;
for (const line of project.lyrics) {
    totalWords += line.words.length;
    if (line.isDuet) duetCount++;
    if (line.translatedLyric) transCount++;
}
console.log(`   - 单词总数: ${totalWords}`);
console.log(`   - 对唱行: ${duetCount}`);
console.log(`   - 含翻译行: ${transCount}`);
console.log(`   - 总时长: ${msToTimestamp(project.lyrics[project.lyrics.length - 1]?.endTime || 0)}`);

// 打印前3行歌词
console.log("\n3. 前3行预览:");
for (const line of project.lyrics.slice(0, 3)) {
    const words = line.words.map(w => `${w.word}[${w.startTime}ms]`).join(' ');
    console.log(`   [${line.id}] ${words}`);
    if (line.translatedLyric) console.log(`     译: ${line.translatedLyric}`);
}

// 4. 序列化回 TTML
const ttml2 = writeTTML(project);
console.log(`\n4. 序列化完成: ${ttml2.length} 字符`);

// 5. 二次解析验证
const project2 = parseTTML(ttml2);
const ttml3 = writeTTML(project2);

// 6. 比较
const issues = [];
if (project2.lyrics.length !== project.lyrics.length) {
    issues.push(`行数不一致: ${project.lyrics.length} vs ${project2.lyrics.length}`);
}
for (let i = 0; i < project.lyrics.length && i < project2.lyrics.length; i++) {
    const l1 = project.lyrics[i];
    const l2 = project2.lyrics[i];
    if (l1.id !== l2.id) issues.push(`行${i} ID不一致: ${l1.id} vs ${l2.id}`);
    if (l1.words.length !== l2.words.length) issues.push(`行${i} 词数不一致: ${l1.words.length} vs ${l2.words.length}`);
    if (l1.startTime !== l2.startTime) issues.push(`行${i} 开始时间不一致: ${l1.startTime} vs ${l2.startTime}`);
    if (l1.endTime !== l2.endTime) issues.push(`行${i} 结束时间不一致: ${l1.endTime} vs ${l2.endTime}`);
    if (l1.translatedLyric !== l2.translatedLyric) issues.push(`行${i} 翻译不一致`);
    if (l1.isDuet !== l2.isDuet) issues.push(`行${i} 对唱标记不一致`);
    for (let j = 0; j < l1.words.length && j < l2.words.length; j++) {
    	const w1 = l1.words[j];
    	const w2 = l2.words[j];
    	if (w1.word !== w2.word) issues.push(`行${i}词${j} 文本不一致: "${w1.word}" vs "${w2.word}"`);
    	if (w1.startTime !== w2.startTime) issues.push(`行${i}词${j} 开始时间不一致: ${w1.startTime} vs ${w2.startTime}`);
    	if (w1.endTime !== w2.endTime) issues.push(`行${i}词${j} 结束时间不一致: ${w1.endTime} vs ${w2.endTime}`);
    }
}

console.log(`\n5. 双向转换验证:`);
if (issues.length === 0) {
    console.log("   ✓ 通过！数据完全一致");
    console.log(`   XML 大小: ${originalText.length} → ${ttml2.length} → ${ttml3.length} 字符`);
} else {
    console.log(`   ✗ 发现 ${issues.length} 个问题:`);
    for (const issue of issues) console.log(`     - ${issue}`);
}

// 7. 保存输出文件供检查
writeFileSync(new URL('./roundtrip-output.ttml', import.meta.url).pathname, ttml2, 'utf8');
console.log(`\n6. 输出文件已保存: test/roundtrip-output.ttml`);
console.log("\n=== 测试完成 ===");

/**
 * Phase 2b 验证脚本：测试 TTML 扩展格式支持
 * 用法：/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node test/roundtrip-v2.mjs
 *
 * 使用 jsdom 模拟浏览器 DOM API（DOMParser, XMLSerializer, Document, Node）
 */

import { readFileSync } from "fs";
import { JSDOM } from "jsdom";

// ---- 设置 jsdom 全局 DOM 环境 ----
const dom = new JSDOM("<!DOCTYPE html><html></html>", {
	contentType: "application/xml",
});

globalThis.DOMParser = dom.window.DOMParser;
globalThis.XMLSerializer = dom.window.XMLSerializer;
globalThis.Document = dom.window.Document;
globalThis.Node = dom.window.Node;

console.log("✓ jsdom DOM 环境就绪\n");

// ---- 导入被测模块 ----
const { parseTTML } = await import("../js/ttml/parser.js");
const { writeTTML } = await import("../js/ttml/writer.js");

let passed = 0;
let failed = 0;

function check(cond, msg) {
	if (cond) {
		passed++;
	} else {
		console.error(`  ✗ 失败: ${msg}`);
		failed++;
	}
}

function section(title) {
	console.log(`\n=== ${title} ===`);
}

// ==================== 测试 1: Helping Hands.ttml ====================
section("1. Helping Hands.ttml (AMLL 格式，向后兼容)");

const hhText = readFileSync(new URL("./Helping Hands.ttml", import.meta.url), "utf8");
const hh = parseTTML(hhText);

check(hh.lyrics.length > 0, `歌词行数: ${hh.lyrics.length}`);
check(hh.agents.length === 2, `agents: ${hh.agents.length} (v1 + v2)`);
check(hh.agents[0].id === "v1" && hh.agents[0].type === "person", "主 agent v1=person");
check(hh.agents[1].id === "v2" && hh.agents[1].type === "other", "副 agent v2=other");

// AMLL 格式：只有 1 个 person agent → "other" 类型的 agent 是对唱搭档
const hhDuet = hh.lyrics.filter((l) => l.isDuet);
const hhBg = hh.lyrics.filter((l) => l.isBackground);
check(hhDuet.length > 0, `对唱行: ${hhDuet.length} (v2 应为对唱)`);
check(hhBg.length === 0, `背景行: 0 (v2 不是背景)`);
check(hh.lyrics[0].agentId === "v1", "默认行 agentId=v1");

// 翻译/音译
const hhTrans = hh.lyrics.filter((l) => l.translatedLyric);
check(hhTrans.length > 0, `翻译行: ${hhTrans.length}`);

let hhWords = 0;
hh.lyrics.forEach((l) => (hhWords += l.words.length));
check(hhWords > 0, `总词数: ${hhWords}`);

// Roundtrip
const hhRT = parseTTML(writeTTML(hh));
let hhRTWords = 0;
hhRT.lyrics.forEach((l) => (hhRTWords += l.words.length));
check(hhRT.lyrics.length === hh.lyrics.length, `roundtrip 行数: ${hh.lyrics.length}`);
check(hhRTWords === hhWords, `roundtrip 词数: ${hhWords}`);
check(hhRT.agents.length === 2, "roundtrip agents 保留");

// ==================== 测试 2: standard_only.ttml ====================
section("2. standard_only.ttml (W3C 标准，新特性)");

const soText = readFileSync(
	new URL("./ttml_examples/standard_only.ttml", import.meta.url),
	"utf8",
);
const so = parseTTML(soText);

// Agents
check(so.agents.length === 3, `agents: ${so.agents.length}`);
const singerA = so.agents.find((a) => a.id === "singerA");
const bgVox = so.agents.find((a) => a.id === "bgVox");
check(singerA && singerA.type === "person" && singerA.name === "Singer A", "singerA 含 name");
check(bgVox && bgVox.type === "other", "bgVox type=other");

// Styles
const sKeys = Object.keys(so.styles);
check(sKeys.length === 3, `styles: ${sKeys.length}`);
check(so.styles.highlight?.properties.color === "yellow", "highlight.color=yellow");
check(so.styles.bgStyle?.properties.fontStyle === "italic", "bgStyle italic");

// Regions
const rKeys = Object.keys(so.regions);
check(rKeys.length === 3, `regions: ${rKeys.length}`);
check(so.regions.main?.textAlign === "center", "main region=center");
check(so.regions.left?.textAlign === "start", "left region=start");

// 元数据
check(so.title === "Standard Only Example", `title: ${so.title}`);
check(so.lang === "en-US", `lang: ${so.lang}`);

// 对唱 vs 背景（标准格式：多个 person agent → other=背景）
const soDuet = so.lyrics.filter((l) => l.isDuet);
const soBg = so.lyrics.filter((l) => l.isBackground);
check(soDuet.length >= 1, `对唱行(singerB): ${soDuet.length}`);
check(soBg.length >= 1, `背景行(bgVox): ${soBg.length}`);
if (soBg.length > 0) check(soBg[0].agentId === "bgVox", "背景行 agentId=bgVox");

// style 引用
const soStyled = so.lyrics.filter((l) => l.styleRef);
check(soStyled.length >= 2, `styleRef 行: ${soStyled.length}`);

// region 归属
const soRegion = so.lyrics.filter((l) => l.regionId);
check(soRegion.length >= 1, `regionId 行: ${soRegion.length}`);

// Roundtrip
const soRT = parseTTML(writeTTML(so));
check(soRT.lyrics.length === so.lyrics.length, "roundtrip 行数");
check(soRT.agents.length === 3, "roundtrip agents");
check(Object.keys(soRT.styles).length === 3, "roundtrip styles");
check(Object.keys(soRT.regions).length === 3, "roundtrip regions");
check(soRT.title === "Standard Only Example", "roundtrip title");
check(
	soRT.lyrics.filter((l) => l.isBackground).length === soBg.length,
	"roundtrip 背景行",
);
check(soRT.lyrics.filter((l) => l.isDuet).length === soDuet.length, "roundtrip 对唱行");

// ==================== 测试 3: full_features.ttml ====================
section("3. full_features.ttml (自定义命名空间兼容)");

const ffText = readFileSync(
	new URL("./ttml_examples/full_features.ttml", import.meta.url),
	"utf8",
);
const ff = parseTTML(ffText);

check(ff.lyrics.length >= 5, `歌词行: ${ff.lyrics.length}`);
check(ff.agents.length === 3, `agents: ${ff.agents.length}`);
check(Object.keys(ff.styles).length === 3, "styles 解析");
check(Object.keys(ff.regions).length === 3, "regions 解析");

// myanim: 自定义属性安全忽略
const ffDuet = ff.lyrics.filter((l) => l.isDuet);
const ffBg = ff.lyrics.filter((l) => l.isBackground);
check(ffDuet.length >= 1, `对唱: ${ffDuet.length}`);
check(ffBg.length >= 1, `背景: ${ffBg.length}`);

let ffWords = 0;
ff.lyrics.forEach((l) => (ffWords += l.words.length));
check(ffWords > 0, `总词数: ${ffWords} (含 myanim: 属性词)`);

// myanim: 属性的 span 被正确识别为单词
const ffStyled = ff.lyrics.flatMap((l) => l.words).filter((w) => w.styleRef);
check(ffStyled.length >= 1, `含 styleRef 的单词: ${ffStyled.length}`);

// Roundtrip
const ffRT = parseTTML(writeTTML(ff));
let ffRTWords = 0;
ffRT.lyrics.forEach((l) => (ffRTWords += l.words.length));
check(ffRT.lyrics.length === ff.lyrics.length, "roundtrip 行数");
check(ffRTWords === ffWords, `roundtrip 词数: ${ffWords}`);

// ==================== 测试 4: edge cases ====================
section("4. 边界情况");

// 空 agents 兜底
const emptyProject = parseTTML(
	'<?xml version="1.0" encoding="UTF-8"?>'
	+ '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xml:lang="ja-JP">'
	+ '<body dur="00:01.000"><div><p begin="00:00.500" end="00:01.000">test</p></div></body>'
	+ '</tt>',
);
check(emptyProject.agents.length > 0, "无 agent 时自动创建默认 v1");
check(emptyProject.lyrics.length === 1, "无 span 的纯文本行正确解析");
check(emptyProject.agents[0].id === "v1", "默认 agent id=v1");
if (emptyProject.lyrics.length > 0) {
	check(emptyProject.lyrics[0].agentId === "v1", "默认行 agentId=v1");
}

// xml:lang 回退
check(emptyProject.lang === "ja-JP", "xml:lang 正确提取");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
	console.log("🎉 全部测试通过！");
	console.log(`  Helping Hands:     ${hh.lyrics.length} 行, ${hhWords} 词, AMLL 对唱兼容 ✓`);
	console.log(`  standard_only:     ${so.lyrics.length} 行, agents/styles/regions/背景 全部正确 ✓`);
	console.log(`  full_features:     ${ff.lyrics.length} 行, ${ffWords} 词, 自定义属性安全忽略 ✓`);
	console.log(`  3 文件 roundtrip  解析→生成→解析 数据一致 ✓`);
} else {
	console.log(`❌ ${failed} 个测试失败`);
	process.exit(1);
}
console.log("═══════════════════════════════════");

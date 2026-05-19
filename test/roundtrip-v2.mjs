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
const hhDuet = hh.lyrics.filter((l) => l.is_duet);
const hhBg = hh.lyrics.filter((l) => l.is_background);
check(hhDuet.length > 0, `对唱行: ${hhDuet.length} (v2 应为对唱)`);
check(hhBg.length === 0, `背景行: 0 (v2 不是背景)`);
check(hh.lyrics[0].agent_id === "v1", "默认行 agent_id=v1");

// 翻译/音译
const hhTrans = hh.lyrics.filter((l) => l.translated_lyric);
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
check(so.regions.main?.text_align === "center", "main region=center");
check(so.regions.left?.text_align === "start", "left region=start");

// 元数据
check(so.title === "Standard Only Example", `title: ${so.title}`);
check(so.lang === "en-US", `lang: ${so.lang}`);

// 对唱 vs 背景（标准格式：多个 person agent → other=背景）
const soDuet = so.lyrics.filter((l) => l.is_duet);
const soBg = so.lyrics.filter((l) => l.is_background);
check(soDuet.length >= 1, `对唱行(singerB): ${soDuet.length}`);
check(soBg.length >= 1, `背景行(bgVox): ${soBg.length}`);
if (soBg.length > 0) check(soBg[0].agent_id === "bgVox", "背景行 agent_id=bgVox");

// style 引用
const soStyled = so.lyrics.filter((l) => l.style_ref);
check(soStyled.length >= 2, `style_ref 行: ${soStyled.length}`);

// region 归属
const soRegion = so.lyrics.filter((l) => l.region_id);
check(soRegion.length >= 1, `regionId 行: ${soRegion.length}`);

// Roundtrip
const soRT = parseTTML(writeTTML(so));
check(soRT.lyrics.length === so.lyrics.length, "roundtrip 行数");
check(soRT.agents.length === 3, "roundtrip agents");
check(Object.keys(soRT.styles).length === 3, "roundtrip styles");
check(Object.keys(soRT.regions).length === 3, "roundtrip regions");
check(soRT.title === "Standard Only Example", "roundtrip title");
check(
    soRT.lyrics.filter((l) => l.is_background).length === soBg.length,
    "roundtrip 背景行",
);
check(soRT.lyrics.filter((l) => l.is_duet).length === soDuet.length, "roundtrip 对唱行");

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
const ffDuet = ff.lyrics.filter((l) => l.is_duet);
const ffBg = ff.lyrics.filter((l) => l.is_background);
check(ffDuet.length >= 1, `对唱: ${ffDuet.length}`);
check(ffBg.length >= 1, `背景: ${ffBg.length}`);

let ffWords = 0;
ff.lyrics.forEach((l) => (ffWords += l.words.length));
check(ffWords > 0, `总词数: ${ffWords} (含 myanim: 属性词)`);

// myanim: 属性的 span 被正确识别为单词
const ffStyled = ff.lyrics.flatMap((l) => l.words).filter((w) => w.style_ref);
check(ffStyled.length >= 1, `含 style_ref 的单词: ${ffStyled.length}`);

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
    check(emptyProject.lyrics[0].agent_id === "v1", "默认行 agent_id=v1");
}

// xml:lang 回退
check(emptyProject.lang === "ja-JP", "xml:lang 正确提取");

// ==================== 测试 5: 动画组 roundtrip ====================
section("5. 动画组 lv:anim-groups roundtrip");

const animTtml = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:lv="http://www.example.com/ns/lyric-vfx" xml:lang="en-US" itunes:timing="Word">
<head>
    <metadata><ttm:agent type="person" xml:id="v1"/></metadata>
</head>
<body dur="00:05.000">
    <div>
    	<p begin="00:00.000" end="00:05.000" itunes:key="L1"
    	   lv:anim-groups='[{"start":{"ref":"lineStart","dir":"after","offset":0},"end":{"ref":"lineEnd","dir":"before","offset":200},"channels":[{"channel_id":"translateY","from":30,"to":0,"curve":"ease-out"}]}]'>
    		<span begin="00:00.000" end="00:02.500"
    		      lv:anim-groups='[{"start":{"ref":"wordStart","dir":"before","offset":500},"end":{"ref":"wordStart","dir":"after","offset":0},"channels":[{"channel_id":"opacity","from":0,"to":1,"curve":"linear"}]}]'>Hello</span>
    		<span begin="00:02.500" end="00:05.000"
    		      lv:anim-groups='[{"start":{"ref":"wordStart","dir":"before","offset":300},"end":{"ref":"wordEnd","dir":"after","offset":100},"channels":[{"channel_id":"blur","from":8,"to":0,"curve":"ease-out"},{"channel_id":"color","from":"#ffffff","to":"#ff0000","curve":"linear"}]}]'>World</span>
    	</p>
    </div>
</body>
</tt>`;

const animProj = parseTTML(animTtml);
check(animProj.lyrics.length === 1, "动画组 TTML 行数=1");
const animLine = animProj.lyrics[0];

// 行动画组
check(animLine.anim_groups.length === 1, `行动画组数量=1 (实际: ${animLine.anim_groups.length})`);
if (animLine.anim_groups.length > 0) {
    const lg = animLine.anim_groups[0];
    check(lg.start.ref === "lineStart", `行动画组 start.ref=lineStart (实际: ${lg.start.ref})`);
    check(lg.start.dir === "after", `行动画组 start.dir=after (实际: ${lg.start.dir})`);
    check(lg.start.offset === 0, `行动画组 start.offset=0 (实际: ${lg.start.offset})`);
    check(lg.end.ref === "lineEnd", `行动画组 end.ref=lineEnd (实际: ${lg.end.ref})`);
    check(lg.end.dir === "before", `行动画组 end.dir=before (实际: ${lg.end.dir})`);
    check(lg.end.offset === 200, `行动画组 end.offset=200 (实际: ${lg.end.offset})`);
    check(lg.channels.length === 1, `行动画组通道数=1 (实际: ${lg.channels.length})`);
    if (lg.channels.length > 0) {
    	check(lg.channels[0].channel_id === "translateY", `行动画组通道=translateY (实际: ${lg.channels[0].channel_id})`);
    	check(lg.channels[0].from === 30, `行动画组 from=30 (实际: ${lg.channels[0].from})`);
    	check(lg.channels[0].curve === "ease-out", `行动画组 curve=ease-out (实际: ${lg.channels[0].curve})`);
    }
}

// 字动画组
check(animLine.words.length === 2, "单词数=2");
check(animLine.words[0].anim_groups.length === 1, `Hello 动画组数=1 (实际: ${animLine.words[0].anim_groups.length})`);
check(animLine.words[1].anim_groups.length === 1, `World 动画组数=1 (实际: ${animLine.words[1].anim_groups.length})`);

if (animLine.words[0].anim_groups.length > 0) {
    const wg = animLine.words[0].anim_groups[0];
    check(wg.start.ref === "wordStart", `Hello start.ref=wordStart`);
    check(wg.start.dir === "before", `Hello start.dir=before`);
    check(wg.start.offset === 500, `Hello start.offset=500 (实际: ${wg.start.offset})`);
    check(wg.channels.length === 1, `Hello 通道数=1`);
    check(wg.channels[0].channel_id === "opacity", `Hello 通道=opacity`);
}

if (animLine.words[1].anim_groups.length > 0) {
    const wg2 = animLine.words[1].anim_groups[0];
    check(wg2.channels.length === 2, `World 通道数=2 (实际: ${wg2.channels.length})`);
    check(wg2.channels[0].channel_id === "blur", `World 通道0=blur (实际: ${wg2.channels[0].channel_id})`);
    check(wg2.channels[1].channel_id === "color", `World 通道1=color (实际: ${wg2.channels[1].channel_id})`);
    check(wg2.channels[0].from === 8, `World blur.from=8 (实际: ${wg2.channels[0].from})`);
    check(wg2.channels[0].to === 0, `World blur.to=0 (实际: ${wg2.channels[0].to})`);
    check(wg2.end.ref === "wordEnd", `World end.ref=wordEnd (实际: ${wg2.end.ref})`);
    check(wg2.end.offset === 100, `World end.offset=100 (实际: ${wg2.end.offset})`);
}

// Roundtrip
const animRT = parseTTML(writeTTML(animProj));
check(animRT.lyrics.length === 1, "roundtrip 行数=1");
check(animRT.lyrics[0].anim_groups.length === 1, "roundtrip 行动画组保留");
check(animRT.lyrics[0].words[0].anim_groups.length === 1, "roundtrip Hello 动画组保留");
check(animRT.lyrics[0].words[1].anim_groups.length === 1, "roundtrip World 动画组保留");

if (animRT.lyrics[0].words[0].anim_groups.length > 0) {
    const rwg = animRT.lyrics[0].words[0].anim_groups[0];
    check(rwg.start.ref === "wordStart", "roundtrip start.ref=wordStart");
    check(rwg.start.offset === 500, "roundtrip start.offset=500");
    check(rwg.channels[0].channel_id === "opacity", "roundtrip 通道=opacity");
    check(rwg.channels[0].from === 0, "roundtrip opacity.from=0");
    check(rwg.channels[0].to === 1, "roundtrip opacity.to=1");
    check(rwg.channels[0].curve === "linear", "roundtrip opacity.curve=linear");
}

if (animRT.lyrics[0].anim_groups.length > 0) {
    const rlg = animRT.lyrics[0].anim_groups[0];
    check(rlg.channels[0].channel_id === "translateY", "roundtrip 行通道=translateY");
    check(rlg.channels[0].from === 30, "roundtrip 行 from=30");
}

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 全部测试通过！");
    console.log(`  Helping Hands:     ${hh.lyrics.length} 行, ${hhWords} 词, AMLL 对唱兼容 ✓`);
    console.log(`  standard_only:     ${so.lyrics.length} 行, agents/styles/regions/背景 全部正确 ✓`);
    console.log(`  full_features:     ${ff.lyrics.length} 行, ${ffWords} 词, 自定义属性安全忽略 ✓`);
    console.log(`  3 文件 roundtrip  解析→生成→解析 数据一致 ✓`);
    console.log(`  动画组 roundtrip  lv:anim-groups 解析+序列化 ✓`);
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

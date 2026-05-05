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
        span.setAttribute("begin", msToTimestamp(word.start_time));
        span.setAttribute("end", msToTimestamp(word.end_time));
        span.textContent = word.word;

        // style 引用
        if (word.style_ref) {
            span.setAttribute("style", word.style_ref);
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
     * @returns {Array<{region_id: string|null, lines: import("./types.js").LyricLine[]}>}
     */
    function groupByRegion() {
        /** @type {Array<{region_id: string|null, lines: import("./types.js").LyricLine[]}>} */
        const groups = [];
        for (const line of lyrics) {
            const last = groups[groups.length - 1];
            if (last && last.region_id === (line.region_id || null)) {
                last.lines.push(line);
            } else {
                groups.push({ region_id: line.region_id || null, lines: [line] });
            }
        }
        return groups;
    }

    // ---- 构建文档 ----

    const tt_root = doc.createElement("tt");
    tt_root.setAttribute("xmlns", NS.tt);
    tt_root.setAttribute("xmlns:ttm", NS.ttm);
    tt_root.setAttribute("xmlns:tts", NS.tts);
    tt_root.setAttribute("xmlns:amll", NS.amll);
    tt_root.setAttribute("xmlns:itunes", NS.itunes);
    tt_root.setAttribute("xmlns:lv", NS.lv);
    tt_root.setAttribute("xml:lang", project.lang || "en-US");
    tt_root.setAttribute("itunes:timing", isDynamicLyric() ? "Word" : "Line");
    doc.appendChild(tt_root);

    // ---- Head + Metadata ----
    const head = doc.createElement("head");
    const metadata = doc.createElement("metadata");

    // 标题
    if (project.title) {
        const title_el = doc.createElement("ttm:title");
        title_el.textContent = project.title;
        metadata.appendChild(title_el);
    }

    // agent 声明
    for (const agent of project.agents) {
        const agent_el = doc.createElement("ttm:agent");
        agent_el.setAttribute("type", agent.type);
        agent_el.setAttribute("xml:id", agent.id);
        if (agent.name) {
            const name_el = doc.createElement("ttm:name");
            name_el.setAttribute("type", "full");
            name_el.textContent = agent.name;
            agent_el.appendChild(name_el);
        }
        metadata.appendChild(agent_el);
    }

    // 如果没有声明任何 agent，添加默认的 v1
    if (project.agents.length === 0) {
        const default_agent = doc.createElement("ttm:agent");
        default_agent.setAttribute("type", "person");
        default_agent.setAttribute("xml:id", "v1");
        metadata.appendChild(default_agent);
    }

    head.appendChild(metadata);

    // ---- Styling ----
    const style_ids = Object.keys(project.styles);
    if (style_ids.length > 0) {
        const styling = doc.createElement("styling");
        for (const sid of style_ids) {
            const s = project.styles[sid];
            const style_el = doc.createElement("style");
            style_el.setAttribute("xml:id", s.id);
            for (const [key, value] of Object.entries(s.properties)) {
                style_el.setAttribute(`tts:${key}`, value);
            }
            styling.appendChild(style_el);
        }
        head.appendChild(styling);
    }

    // ---- Layout ----
    const region_ids = Object.keys(project.regions);
    if (region_ids.length > 0) {
        const layout = doc.createElement("layout");
        for (const rid of region_ids) {
            const r = project.regions[rid];
            const region_el = doc.createElement("region");
            region_el.setAttribute("xml:id", r.id);
            if (r.origin) region_el.setAttribute("tts:origin", r.origin);
            if (r.extent) region_el.setAttribute("tts:extent", r.extent);
            if (r.text_align) region_el.setAttribute("tts:textAlign", r.text_align);
            if (r.display_align) region_el.setAttribute("tts:displayAlign", r.display_align);
            if (r.style_ref) region_el.setAttribute("style", r.style_ref);
            layout.appendChild(region_el);
        }
        head.appendChild(layout);
    }

    tt_root.appendChild(head);

    // ---- Body ----
    const body = doc.createElement("body");
    const total_duration = lyrics.length > 0
        ? Math.max(...lyrics.map((l) => l.end_time))
        : 0;
    body.setAttribute("dur", msToTimestamp(total_duration));

    const dynamic = isDynamicLyric();
    const groups = groupByRegion();

    for (const group of groups) {
        const div = doc.createElement("div");
        if (group.region_id) {
            div.setAttribute("region", group.region_id);
        }
        if (group.lines.length > 0) {
            div.setAttribute("begin", msToTimestamp(group.lines[0].start_time));
            div.setAttribute("end", msToTimestamp(group.lines[group.lines.length - 1].end_time));
        }

        for (const line of group.lines) {
            const p = doc.createElement("p");
            p.setAttribute("begin", msToTimestamp(line.start_time));
            p.setAttribute("end", msToTimestamp(line.end_time));
            p.setAttribute("ttm:agent", line.agent_id || "v1");
            p.setAttribute("itunes:key", line.id);

            // style 引用
            if (line.style_ref) {
                p.setAttribute("style", line.style_ref);
            }

            // 行级 region（覆盖 div 的 region）
            if (line.region_id && line.region_id !== group.region_id) {
                p.setAttribute("region", line.region_id);
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
            if (line.translated_lyric) {
                const trans_span = doc.createElement("span");
                trans_span.setAttribute("ttm:role", "x-translation");
                trans_span.setAttribute("xml:lang", "zh-CN");
                trans_span.textContent = line.translated_lyric;
                p.appendChild(trans_span);
            }

            // 音译
            if (line.roman_lyric) {
                const roman_span = doc.createElement("span");
                roman_span.setAttribute("ttm:role", "x-roman");
                roman_span.textContent = line.roman_lyric;
                p.appendChild(roman_span);
            }

            div.appendChild(p);
        }

        body.appendChild(div);
    }

    tt_root.appendChild(body);

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
 * @param {string} ttml_text
 * @param {string} [filename="lyric.ttml"]
 */
export function downloadTTML(ttml_text, filename = "lyric.ttml") {
    const blob = new Blob([ttml_text], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

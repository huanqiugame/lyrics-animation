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
 * @param {Element} word_el - span 元素
 * @returns {import("./types.js").LyricWord|null}
 */
function wordFromElement(word_el) {
    const begin = getAttr(word_el, "begin");
    const end = getAttr(word_el, "end");
    if (!begin || !end) return null;

    const text = word_el.textContent ?? "";
    const word = createLyricWord(text, parseTimespan(begin), parseTimespan(end));

    // style 引用
    const style_ref = getAttr(word_el, "style");
    if (style_ref) word.style_ref = style_ref;

    // lv: 自定义样式属性
    const style = {};
    const scale = getAttr(word_el, "lv:scale");
    if (scale !== null) style.scale = Number(scale);
    const color = getAttr(word_el, "lv:color");
    if (color !== null) style.color = color;
    const bold = getAttr(word_el, "lv:bold");
    if (bold !== null) style.bold = bold === "true";

    if (Object.keys(style).length > 0) word.style = style;

    // lv: 动画组
    const anim_json = getAttr(word_el, "lv:anim-groups");
    if (anim_json !== null) {
        try {
            const parsed = JSON.parse(anim_json);
            if (Array.isArray(parsed)) word.anim_groups = parsed;
        } catch (_) { /* 忽略格式错误的 JSON */ }
    }

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
    for (const el of doc.getElementsByTagName("ttm:agent")) {
        const id = el.getAttribute("xml:id");
        const type = el.getAttribute("type") || "person";
        const name_el = el.getElementsByTagName("ttm:name")[0];
        const name = name_el ? (name_el.textContent ?? "").trim() : "";
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
    const style_elements = doc.querySelectorAll("styling style");
    for (const el of style_elements) {
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
    const region_elements = doc.querySelectorAll("layout region");
    for (const el of region_elements) {
        const id = el.getAttribute("xml:id");
        if (!id) continue;
        regions[id] = {
            id,
            origin: getAttr(el, "origin") || "",
            extent: getAttr(el, "extent") || "",
            text_align: getAttr(el, "textAlign") || "",
            display_align: getAttr(el, "displayAlign") || "",
            style_ref: el.getAttribute("style") || null,
        };
    }
    return regions;
}

/**
 * 解析 TTML 字符串
 * @param {string} ttml_text - TTML XML 文本
 * @returns {import("./types.js").ProjectData}
 */
export function parseTTML(ttml_text) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(ttml_text, "application/xml");

    const parse_error = doc.querySelector("parsererror");
    if (parse_error) {
        throw new Error(`TTML 解析失败：${parse_error.textContent}`);
    }

    const project = createEmptyProject();

    // 元数据
    project.lang = doc.documentElement.getAttribute("xml:lang") || "en-US";
    const title_el = doc.getElementsByTagName("ttm:title")[0];
    if (title_el) project.title = (title_el.textContent ?? "").trim();

    // 解析 head 中的结构化数据
    project.agents = parseAgents(doc);
    project.styles = parseStyles(doc);
    project.regions = parseRegions(doc);

    // 确定主 agent：第一个 type="person" 的 agent
    let main_agent_id = "v1";
    for (const agent of project.agents) {
        if (agent.type === "person") {
            main_agent_id = agent.id;
            break;
        }
    }
    // 如果没有声明任何 agent，用 "v1" 兜底
    if (project.agents.length === 0) {
        project.agents.push({ id: "v1", type: "person", name: "" });
    }

    /**
     * 根据 agent id 查找 agent 信息
     * @param {string} agent_id
     * @returns {import("./types.js").AgentInfo|undefined}
     */
    function findAgent(agent_id) {
        return project.agents.find((a) => a.id === agent_id);
    }

    // 遍历所有 <div>，每个 div 下有多个 <p>
    const div_elements = doc.querySelectorAll("body div");
    const containers = div_elements.length > 0 ? div_elements : [doc.querySelector("body")];

    for (const container of containers) {
        if (!container) continue;

        // 提取容器的 region 属性（<div region="...">）
        const container_region = container.getAttribute("region");

        // 获取容器内的 <p> 元素（body 下直接用 querySelectorAll("p")，div 下用 children）
        const line_elements = container.tagName === "div"
            ? container.querySelectorAll(":scope > p")
            : container.querySelectorAll("p");

        for (const line_el of line_elements) {
            const begin_attr = getAttr(line_el, "begin");
            const end_attr = getAttr(line_el, "end");
            if (!begin_attr || !end_attr) continue;

            const line = createLyricLine();
            line.id = getAttr(line_el, "itunes:key") || `L_${project.lyrics.length}`;
            line.start_time = parseTimespan(begin_attr);
            line.end_time = parseTimespan(end_attr);

            // agent 归属
            const agent_id = getAttr(line_el, "ttm:agent") || main_agent_id;
            line.agent_id = agent_id;

            const agent = findAgent(agent_id);
            const person_count = project.agents.filter((a) => a.type === "person").length;
            if (person_count === 1 && agent && agent.type !== "person") {
                // AMLL 格式：仅 1 个 person agent，其他 type 是对唱搭档
                line.is_duet = true;
                line.is_background = false;
            } else {
                line.is_duet = agent_id !== main_agent_id && (!agent || agent.type === "person");
                line.is_background = !!agent && agent.type !== "person";
            }

            // style 引用
            const style_ref = getAttr(line_el, "style");
            if (style_ref) line.style_ref = style_ref;

            // region 归属（行级 region 覆盖容器级）
            const line_region = line_el.getAttribute("region") || container_region;
            if (line_region) line.region_id = line_region;

            // 逐行 lv: 样式覆盖
            const line_style = {};
            const l_scale = getAttr(line_el, "lv:scale");
            if (l_scale !== null) line_style.scale = Number(l_scale);
            const l_color = getAttr(line_el, "lv:color");
            if (l_color !== null) line_style.color = l_color;
            if (Object.keys(line_style).length > 0) line.style = line_style;

            // 逐行动画组
            const line_anim = getAttr(line_el, "lv:anim-groups");
            if (line_anim !== null) {
                try {
                    const parsed = JSON.parse(line_anim);
                    if (Array.isArray(parsed)) line.anim_groups = parsed;
                } catch (_) { /* 忽略格式错误的 JSON */ }
            }

            // 遍历子节点
            let after_space = false;
            for (const child of line_el.childNodes) {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent ?? "";
                    if (text.trim().length === 0) {
                        if (text.includes(" ")) after_space = true;
                        continue;
                    }
                    const w = createLyricWord(text, line.start_time, line.end_time);
                    line.words.push(w);
                    after_space = false;
                    continue;
                }

                if (child.nodeType !== Node.ELEMENT_NODE) continue;
                const el = /** @type {Element} */ (child);

                if (localName(el) !== "span") continue;

                const role = getAttr(el, "ttm:role");
                if (role === "x-translation") {
                    line.translated_lyric = (el.textContent ?? "").trim();
                } else if (role === "x-roman") {
                    line.roman_lyric = (el.textContent ?? "").trim();
                } else {
                    const word = wordFromElement(el);
                    if (word) {
                        if (after_space) {
                            word.word = " " + word.word;
                            after_space = false;
                        }
                        line.words.push(word);
                    }
                }
            }

            if (line.words.length === 0 && !line.translated_lyric) continue;
            project.lyrics.push(line);
        }
    }

    return project;
}

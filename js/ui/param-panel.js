/**
 * 动画参数控制面板
 * 提供全局 Text/Blur/Scroll 配置控件 + 行级/字级动画组编辑
 *
 * 选中行时：行动画组编辑器显示该行动画组，变更写入 line.anim_groups
 * 未选中时：行动画组编辑器显示全局 line_anim_groups
 */

import { bus } from "../utils/events.js";
import { h } from "../utils/dom.js";
import { EASING_PRESETS } from "../animation/easing.js";
import { createAnimEditor } from "./anim-editor.js";

/** @type {import("../ttml/types.js").AnimationConfig|null} */
let config = null;

/** @type {import("../ttml/types.js").ProjectData|null} */
let project = null;

/** @type {import("../ttml/types.js").LyricLine|null} */
let selected_line = null;

/** @type {import("../ttml/types.js").LyricWord|null} */
let selected_word = null;

/** @type {number|null} */
let debounce_timer = null;

// DOM 元素引用 (填充于 init 阶段)
const els = {};

/**
 * 初始化参数面板
 * @param {HTMLElement} container - #param-panel 元素
 */
export function initParamPanel(container) {
    // ---- 文字区块 ----
    const txt_font = createTextInput("字体", "text.font_family");
    const txt_size = createRange("字号", 12, 96, 1, "text.font_size", "px");
    const txt_color = createColorPicker("颜色", "text.color");
    const txt_shadow = createTextInput("阴影", "text.text_shadow");
    const txt_stroke = createTextInput("描边", "text.stroke");

    const text_section = h("div", { className: "param-section" },
        h("div", { className: "param-section-title" }, "文字"),
        h("div", { className: "param-section-body" },
            txt_font.el, txt_size.el, txt_color.el, txt_shadow.el, txt_stroke.el,
        ),
    );

    // ---- 模糊区块 ----
    const blur_toggle = createToggle("启用模糊", "blur.enabled");
    const blur_start = createRange("起始模糊", 0, 20, 1, "blur.start_amount", "px");
    const blur_end_display = createReadOnly("结束模糊", "blur.end_amount", "px");
    const blur_duration = createSelect("应用方式", "blur.duration", [
        ["word", "逐字"],
        ["line", "逐行"],
    ]);

    const blur_section = h("div", { className: "param-section" },
        h("div", { className: "param-section-title" },
            blur_toggle.el,
        ),
        h("div", { className: "param-section-body" },
            blur_start.el, blur_end_display.el, blur_duration.el,
        ),
    );

    // 模糊 enable/disable
    blur_toggle.input.addEventListener("change", () => {
        const body = blur_section.lastElementChild;
        updateDisabled(body, blur_toggle.input.checked);
        emitConfigChanged();
    });

    // ---- 滚动区块 ----
    const scroll_toggle = createToggle("启用滚动", "scroll.enabled");
    const scroll_dir = createSelect("方向", "scroll.direction", [
        ["up", "向上"],
        ["down", "向下"],
    ]);
    const scroll_dist = createRange("距离", 0, 50, 1, "scroll.distance", " vh");
    const scroll_easing = createSelect("缓动", "scroll.easing", easingOptions());

    const scroll_section = h("div", { className: "param-section" },
        h("div", { className: "param-section-title" },
            scroll_toggle.el,
        ),
        h("div", { className: "param-section-body" },
            scroll_dir.el, scroll_dist.el, scroll_easing.el,
        ),
    );

    // 滚动 enable/disable
    scroll_toggle.input.addEventListener("change", () => {
        const body = scroll_section.lastElementChild;
        updateDisabled(body, scroll_toggle.input.checked);
        emitConfigChanged();
    });

    // ---- 行动画组区块 ----
    const line_editor_box = h("div", { className: "param-section-body" });
    const line_editor = createAnimEditor(line_editor_box);
    line_editor.onChange((groups) => {
        if (selected_line) {
            selected_line.anim_groups = groups;
            if (project) bus.emit("lyrics:modified", project);
        } else {
            if (config) config.line_anim_groups = groups;
            emitConfigChanged();
        }
    });

    const line_title = h("div", { className: "param-section-title" }, "全局行动画组");
    const line_anim_section = h("div", { className: "param-section" },
        line_title,
        line_editor_box,
    );

    // ---- 字动画组区块 ----
    const word_editor_box = h("div", { className: "param-section-body" });
    const word_editor = createAnimEditor(word_editor_box);
    word_editor.onChange((groups) => {
        if (selected_word) {
            selected_word.anim_groups = groups;
            if (project) bus.emit("lyrics:modified", project);
        } else {
            if (config) config.word_anim_groups = groups;
            emitConfigChanged();
        }
    });

    const word_title = h("div", { className: "param-section-title" }, "全局字动画组");
    const word_anim_section = h("div", { className: "param-section" },
        word_title,
        word_editor_box,
    );

    // ---- 组装 ----
    container.appendChild(text_section);
    container.appendChild(blur_section);
    container.appendChild(scroll_section);
    container.appendChild(line_anim_section);
    container.appendChild(word_anim_section);

    // 存引用供 readConfig / updateEditorMode 使用
    els.text = { font: txt_font, size: txt_size, color: txt_color, shadow: txt_shadow, stroke: txt_stroke };
    els.blur = { toggle: blur_toggle, start: blur_start, end_display: blur_end_display, duration: blur_duration };
    els.scroll = { toggle: scroll_toggle, dir: scroll_dir, dist: scroll_dist, easing: scroll_easing };
    els.blurBody = blur_section.lastElementChild;
    els.scrollBody = scroll_section.lastElementChild;
    els.lineEditor = line_editor;
    els.wordEditor = word_editor;
    els.lineTitle = line_title;
    els.wordTitle = word_title;

    // ---- 事件绑定 ----
    bus.on("lyrics:loaded", (p) => {
        project = p;
        selected_line = null;
        selected_word = null;
        if (p && p.anim_config) {
            readConfig(p.anim_config);
            updateEditorMode();
        }
    });

    bus.on("ui:selectLine", ({ line }) => {
        selected_line = line;
        selected_word = null;
        updateEditorMode();
    });

    bus.on("ui:selectWord", ({ word }) => {
        selected_word = word;
        updateEditorMode();
    });
}

// ==================== 控件工厂 ====================

function createTextInput(label, key) {
    const input = h("input", { type: "text" });
    input.addEventListener("change", () => emitConfigChanged());
    return {
        el: paramGroup(label, [input]),
        input,
        key,
        set(v) { input.value = v; },
        get() { return input.value; },
    };
}

function createRange(label, min, max, step, key, unit) {
    const input = h("input", { type: "range", min, max, step });
    const display = h("span", { className: "param-value" }, "");
    input.addEventListener("input", () => {
        display.textContent = input.value + unit;
        scheduleEmit();
    });
    return {
        el: paramGroup(label, [input, display]),
        input,
        display,
        key,
        unit,
        set(v) { input.value = v; display.textContent = v + unit; },
        get() { return Number(input.value); },
    };
}

function createColorPicker(label, key) {
    const input = h("input", { type: "color" });
    input.addEventListener("input", () => emitConfigChanged());
    return {
        el: paramGroup(label, [input]),
        input,
        key,
        set(v) { input.value = v; },
        get() { return input.value; },
    };
}

function createSelect(label, key, options) {
    const select = h("select");
    for (const [value, text] of options) {
        select.appendChild(h("option", { value }, text));
    }
    select.addEventListener("change", () => emitConfigChanged());
    return {
        el: paramGroup(label, [select]),
        select,
        key,
        set(v) { select.value = v; },
        get() { return select.value; },
    };
}

function createToggle(label, key) {
    const input = h("input", { type: "checkbox", className: "section-toggle" });
    const label_el = h("label", { className: "param-toggle" }, input, label);
    return {
        el: label_el,
        input,
        key,
        set(v) { input.checked = v; },
        get() { return input.checked; },
    };
}

function createReadOnly(label, key, unit) {
    const display = h("span", { className: "param-value" }, "0" + unit);
    return {
        el: paramGroup(label, [h("span", { className: "param-controls" }, display)]),
        display,
        key,
        set(v) { display.textContent = v + unit; },
    };
}

// ==================== 辅助函数 ====================

function paramGroup(label_text, controls) {
    return h("div", { className: "param-group" },
        h("label", {}, label_text),
        h("div", { className: "param-controls" }, ...controls),
    );
}

function easingOptions() {
    const opts = [];
    for (const [id, preset] of EASING_PRESETS) {
        opts.push([id, preset.label]);
    }
    return opts;
}

function updateDisabled(body, enabled) {
    body.classList.toggle("disabled", !enabled);
    const inputs = body.querySelectorAll("input, select");
    for (const el of inputs) {
        if (el.classList.contains("section-toggle")) continue;
        el.disabled = !enabled;
    }
}

// ==================== 读取 / 发射 / 模式切换 ====================

function readConfig(cfg) {
    config = JSON.parse(JSON.stringify(cfg)); // 深拷贝

    // Text
    els.text.font.set(cfg.text.font_family);
    els.text.size.set(cfg.text.font_size);
    els.text.color.set(cfg.text.color);
    els.text.shadow.set(cfg.text.text_shadow);
    els.text.stroke.set(cfg.text.stroke);

    // Blur
    els.blur.toggle.set(cfg.blur.enabled);
    els.blur.start.set(cfg.blur.start_amount);
    els.blur.end_display.set(cfg.blur.end_amount);
    els.blur.duration.set(cfg.blur.duration);
    updateDisabled(els.blurBody, cfg.blur.enabled);

    // Scroll
    els.scroll.toggle.set(cfg.scroll.enabled);
    els.scroll.dir.set(cfg.scroll.direction);
    els.scroll.dist.set(cfg.scroll.distance);
    els.scroll.easing.set(cfg.scroll.easing);
    updateDisabled(els.scrollBody, cfg.scroll.enabled);
}

/**
 * 根据选中状态更新动画组编辑器的内容和标题
 */
function updateEditorMode() {
    if (selected_line) {
        els.lineEditor.load(selected_line.anim_groups || []);
        els.lineTitle.textContent = `行动画组 [${selected_line.id}]`;
    } else {
        els.lineEditor.load(config ? config.line_anim_groups : []);
        els.lineTitle.textContent = "全局行动画组";
    }

    if (selected_word) {
        els.wordEditor.load(selected_word.anim_groups || []);
        els.wordTitle.textContent = `字动画组 [${selected_word.word}]`;
    } else {
        els.wordEditor.load(config ? config.word_anim_groups : []);
        els.wordTitle.textContent = "全局字动画组";
    }
}

function emitConfigChanged() {
    const new_config = {
        blur: {
            enabled: els.blur.toggle.get(),
            start_amount: els.blur.start.get(),
            end_amount: 0,
            duration: els.blur.duration.get(),
        },
        scroll: {
            enabled: els.scroll.toggle.get(),
            direction: els.scroll.dir.get(),
            distance: els.scroll.dist.get(),
            easing: els.scroll.easing.get(),
        },
        text: {
            font_family: els.text.font.get(),
            font_size: els.text.size.get(),
            color: els.text.color.get(),
            text_shadow: els.text.shadow.get(),
            stroke: els.text.stroke.get(),
        },
        line_anim_groups: config ? config.line_anim_groups : [],
        word_anim_groups: config ? config.word_anim_groups : [],
    };
    config = new_config;
    bus.emit("config:changed", new_config);
}

function scheduleEmit() {
    if (debounce_timer) clearTimeout(debounce_timer);
    debounce_timer = setTimeout(() => {
        debounce_timer = null;
        emitConfigChanged();
    }, 50);
}

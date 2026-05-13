/**
 * 动画参数控制面板
 * 提供 行级/字级动画组编辑
 *
 * 选中行时：行动画组编辑器显示该行动画组，变更写入 line.anim_groups
 * 未选中时：行动画组编辑器显示全局 line_anim_groups
 *
 * 选中词时：字动画组编辑器显示该词动画组，变更写入 word.anim_groups
 * 未选中时：字动画组编辑器显示全局 word_anim_groups
 */

import { bus } from "../utils/events.js";
import { h } from "../utils/dom.js";
import { createAnimEditor } from "./anim-editor.js";

/** @type {import("../ttml/types.js").AnimationConfig|null} */
let config = null;

/** @type {import("../ttml/types.js").ProjectData|null} */
let project = null;

/** @type {import("../ttml/types.js").LyricLine|null} */
let selected_line = null;

/** @type {import("../ttml/types.js").LyricWord|null} */
let selected_word = null;

// DOM 元素引用 (填充于 init 阶段)
const els = {};

/**
 * 初始化参数面板
 * @param {HTMLElement} container - #param-panel 元素
 */
export function initParamPanel(container) {
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

    // ---- 行动画组: 展开/折叠全部按钮 ----
    function makeCollapseButtons(editor, container_box) {
        const actions = h("span", { className: "title-actions" });
        const collapse_btn = h("button", { className: "btn-icon", type: "button" }, "折叠全部");
        const expand_btn = h("button", { className: "btn-icon", type: "button" }, "展开全部");
        collapse_btn.addEventListener("click", () => editor.collapseAll());
        expand_btn.addEventListener("click", () => editor.expandAll());
        actions.appendChild(collapse_btn);
        actions.appendChild(expand_btn);
        return actions;
    }

    const line_title_text = h("span", {}, "全局行动画组");
    const line_title = h("div", { className: "param-section-title" },
        line_title_text,
        makeCollapseButtons(line_editor, line_editor_box),
    );
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

    const word_title_text = h("span", {}, "全局字动画组");
    const word_title = h("div", { className: "param-section-title" },
        word_title_text,
        makeCollapseButtons(word_editor, word_editor_box),
    );
    const word_anim_section = h("div", { className: "param-section" },
        word_title,
        word_editor_box,
    );

    // ---- 组装 ----
    container.appendChild(line_anim_section);
    container.appendChild(word_anim_section);

    // 存引用供 updateEditorMode 使用（仅文字 span，避免替换掉折叠按钮）
    els.lineEditor = line_editor;
    els.wordEditor = word_editor;
    els.lineTitle = line_title_text;
    els.wordTitle = word_title_text;

    // ---- 事件绑定 ----
    bus.on("lyrics:loaded", (p) => {
        project = p;
        selected_line = null;
        selected_word = null;
        if (p && p.anim_config) {
            config = JSON.parse(JSON.stringify(p.anim_config));
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

// ==================== 模式切换 ====================

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
        line_anim_groups: config ? config.line_anim_groups : [],
        word_anim_groups: config ? config.word_anim_groups : [],
    };
    config = new_config;
    bus.emit("config:changed", new_config);
}

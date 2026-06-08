/**
 * 动画参数控制面板
 * 提供 行级/字级动画组编辑
 *
 * 包含两个层级的编辑区：
 * 1. 自定义动画组（可编辑可增删）
 * 2. 默认动画组（默认折叠只读，Alt+点击展开后可编辑但不增删）
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

/** @type {import("../ttml/types.js").AnimationConfig|null} */
let defaultAnimConfig = null;

/** @type {import("../ttml/types.js").ProjectData|null} */
let project = null;

/** @type {import("../ttml/types.js").LyricLine|null} */
let selected_line = null;

/** @type {import("../ttml/types.js").LyricWord|null} */
let selected_word = null;

// 默认动画组编辑区状态
const defaultStates = {
    line: { editingEnabled: false },
    word: { editingEnabled: false },
};

// 作用域过滤器常量
const SCOPE_FILTERS = [
    ["all", "所有"],
    ["standard", "标准"],
    ["duet", "对唱"],
    ["background", "背景"],
];

// 多选过滤器状态（Set 存储选中的 scope 值）
let line_scope_filter = new Set();
let word_scope_filter = new Set();

// DOM 元素引用 (填充于 init 阶段)
const els = {};

// ==================== 工具函数 ====================

/**
 * 根据多选过滤器筛选动画组
 * 空 Set = 显示全部；非空 Set = 显示匹配任一选中 scope 的组
 * @param {import("../ttml/types.js").AnimationGroup[]} groups
 * @param {Set<string>} filter
 * @returns {import("../ttml/types.js").AnimationGroup[]}
 */
function filterGroups(groups, filter) {
    if (filter.size === 0) return groups;
    return groups.filter((g) => filter.has(g.scope || "all"));
}

/**
 * 获取过滤器的首选 scope（第一个选中项）
 * @param {Set<string>} filter
 * @returns {string}
 */
function getPreferredScope(filter) {
    if (filter.size === 0) return "all";
    return filter.values().next().value;
}

/**
 * 创建作用域过滤器按钮组
 * @param {Set<string>} filterState - 对应的过滤器状态引用
 * @param {Function} onUpdate - 过滤器变化时的回调
 * @returns {HTMLElement}
 */
function makeScopeFilterBar(filterState, onUpdate) {
    const bar = h("div", { className: "scope-filter-bar" });
    for (const [val, label] of SCOPE_FILTERS) {
        const btn = h("button", {
            className: "scope-filter-btn",
            type: "button",
            "data-scope": val,
        }, label);
        btn.addEventListener("click", () => {
            if (filterState.has(val)) {
                filterState.delete(val);
                btn.classList.remove("active");
            } else {
                filterState.add(val);
                btn.classList.add("active");
            }
            onUpdate();
        });
        bar.appendChild(btn);
    }
    return bar;
}

/**
 * 创建默认动画组区块（含标题和可折叠内容区）
 * @param {{ editingEnabled: boolean }} state - 编辑状态引用
 * @returns {{ title: HTMLElement, body: HTMLElement, badge: HTMLElement, icon: HTMLElement, setEditor: Function }}
 */
function createDefaultSection(state) {
    const collapse_icon = h("span", { className: "collapse-icon" }, "▶");
    const badge = h("span", { className: "default-badge" }, "只读");
    const title = h("div", { className: "default-section-title" },
        collapse_icon,
        h("span", {}, "默认动画组"),
        badge,
    );
    const body = h("div", { className: "param-section-body default-section-body" });
    body.style.display = "none";

    let expanded = false;
    let editor = null;

    const setEditor = (e) => { editor = e; };

    title.addEventListener("click", (e) => {
        if (!editor) return;
        expanded = !expanded;

        if (expanded && e.altKey) {
            // Alt+展开：进入可编辑模式（仍不可增删）
            state.editingEnabled = true;
            editor.setReadOnly(false);
            editor.setLockStructure(true);
            badge.textContent = "可编辑";
            badge.className = "default-badge editable";
        } else if (expanded) {
            // 普通展开：只读查看
            state.editingEnabled = false;
            editor.setReadOnly(true);
            badge.textContent = "只读";
            badge.className = "default-badge";
        }

        if (!expanded) {
            // 折叠时重置为只读
            state.editingEnabled = false;
            editor.setReadOnly(true);
            badge.textContent = "只读";
            badge.className = "default-badge";
        }

        body.style.display = expanded ? "" : "none";
        collapse_icon.textContent = expanded ? "▼" : "▶";
    });

    return { title, body, badge, icon: collapse_icon, setEditor };
}

/**
 * 初始化参数面板
 * @param {HTMLElement} container - #param-panel 元素
 */
export function initParamPanel(container) {
    // ========== 行动画组区块（自定义） ==========
    const line_editor_box = h("div", { className: "param-section-body" });
    const line_editor = createAnimEditor(line_editor_box);
    line_editor.onChange((groups) => {
        if (selected_line) {
            selected_line.anim_groups = groups;
            if (project) bus.emit("lyrics:modified", project);
        } else if (config) {
            if (line_scope_filter.size === 0) {
                // 无过滤：直接替换全部
                config.line_anim_groups = groups;
            } else {
                // 过滤模式：保留不匹配的组，替换匹配的组
                const others = config.line_anim_groups.filter(
                    (g) => !line_scope_filter.has(g.scope || "all"),
                );
                config.line_anim_groups = [...others, ...groups];
            }
            emitConfigChanged();
        }
    });

    // ---- 行动画组: 展开/折叠全部按钮 ----
    function makeCollapseButtons(editor) {
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
        makeCollapseButtons(line_editor),
    );

    // ---- 行作用域过滤器按钮组 ----
    const line_scope_filter_bar = makeScopeFilterBar(line_scope_filter, updateEditorMode);

    // ---- 默认行动画组区块（只读、折叠） ----
    const line_default_section = createDefaultSection(defaultStates.line);
    const line_default_editor = createAnimEditor(line_default_section.body);
    line_default_section.setEditor(line_default_editor);
    line_default_editor.onChange((groups) => {
        if (!defaultAnimConfig) return;
        defaultAnimConfig.line_anim_groups = groups;
        if (project) bus.emit("defaultConfig:changed", defaultAnimConfig);
    });
    line_default_editor.load(
        defaultAnimConfig ? defaultAnimConfig.line_anim_groups : [],
        { readOnly: true, lockStructure: true },
    );

    const line_anim_section = h("div", { className: "param-section" },
        line_title,
        line_scope_filter_bar,
        line_editor_box,
        line_default_section.title,
        line_default_section.body,
    );

    // ========== 字动画组区块（自定义） ==========
    const word_editor_box = h("div", { className: "param-section-body" });
    const word_editor = createAnimEditor(word_editor_box);
    word_editor.onChange((groups) => {
        if (selected_word) {
            selected_word.anim_groups = groups;
            if (project) bus.emit("lyrics:modified", project);
        } else if (config) {
            if (word_scope_filter.size === 0) {
                config.word_anim_groups = groups;
            } else {
                const others = config.word_anim_groups.filter(
                    (g) => !word_scope_filter.has(g.scope || "all"),
                );
                config.word_anim_groups = [...others, ...groups];
            }
            emitConfigChanged();
        }
    });

    const word_title_text = h("span", {}, "全局字动画组");
    const word_title = h("div", { className: "param-section-title" },
        word_title_text,
        makeCollapseButtons(word_editor),
    );

    // ---- 字作用域过滤器按钮组 ----
    const word_scope_filter_bar = makeScopeFilterBar(word_scope_filter, updateEditorMode);

    // ---- 默认字动画组区块（只读、折叠） ----
    const word_default_section = createDefaultSection(defaultStates.word);
    const word_default_editor = createAnimEditor(word_default_section.body);
    word_default_section.setEditor(word_default_editor);
    word_default_editor.onChange((groups) => {
        if (!defaultAnimConfig) return;
        defaultAnimConfig.word_anim_groups = groups;
        if (project) bus.emit("defaultConfig:changed", defaultAnimConfig);
    });
    word_default_editor.load(
        defaultAnimConfig ? defaultAnimConfig.word_anim_groups : [],
        { readOnly: true, lockStructure: true },
    );

    const word_anim_section = h("div", { className: "param-section" },
        word_title,
        word_scope_filter_bar,
        word_editor_box,
        word_default_section.title,
        word_default_section.body,
    );

    // ========== 组装 ==========
    container.appendChild(line_anim_section);
    container.appendChild(word_anim_section);

    // 存引用
    els.lineEditor = line_editor;
    els.wordEditor = word_editor;
    els.lineDefaultEditor = line_default_editor;
    els.wordDefaultEditor = word_default_editor;
    els.lineTitle = line_title_text;
    els.wordTitle = word_title_text;
    els.lineDefaultSection = line_default_section;
    els.wordDefaultSection = word_default_section;
    els.lineScopeFilterBar = line_scope_filter_bar;
    els.wordScopeFilterBar = word_scope_filter_bar;

    // ========== 事件绑定 ==========
    bus.on("lyrics:loaded", (p) => {
        project = p;
        selected_line = null;
        selected_word = null;
        if (p && p.anim_config) {
            config = JSON.parse(JSON.stringify(p.anim_config));
            updateEditorMode();
        }
        // 同步默认动画配置
        defaultAnimConfig = (p && p.default_anim_config)
            ? p.default_anim_config
            : { line_anim_groups: [], word_anim_groups: [] };
        updateDefaultEditors();
        // 重置默认区块的展开状态
        resetDefaultSection(els.lineDefaultSection, defaultStates.line);
        resetDefaultSection(els.wordDefaultSection, defaultStates.word);
    });

    bus.on("config:changed", (newConfig) => {
        if (!project) return;
        config = newConfig;
        project.anim_config = newConfig;
        updateEditorMode();
    });

    bus.on("defaultConfig:changed", (newConfig) => {
        if (!project) return;
        defaultAnimConfig = newConfig;
        project.default_anim_config = newConfig;
        updateDefaultEditors();
        // 不重置展开状态，用户可能正在编辑
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
 * 根据选中状态更新自定义动画组编辑器的内容和标题
 */
function updateEditorMode() {
    // ---- 行动画组 ----
    if (selected_line) {
        // 选中行：显示该行动画组，scope 禁用，隐藏过滤器
        els.lineEditor.load(selected_line.anim_groups || [], { disableScope: true });
        els.lineTitle.textContent = `行动画组 [${selected_line.id}]`;
        els.lineScopeFilterBar.style.display = "none";
    } else {
        // 全局：显示过滤后的动画组
        const all_groups = config ? config.line_anim_groups : [];
        const filtered = filterGroups(all_groups, line_scope_filter);
        const preferred = getPreferredScope(line_scope_filter);
        els.lineEditor.load(filtered, { disableScope: false, preferredScope: preferred });
        els.lineTitle.textContent = "全局行动画组";
        els.lineScopeFilterBar.style.display = "";
    }

    // ---- 字动画组 ----
    if (selected_word) {
        // 选中词：显示该词动画组，scope 禁用，隐藏过滤器
        els.wordEditor.load(selected_word.anim_groups || [], { disableScope: true });
        els.wordTitle.textContent = `字动画组 [${selected_word.word}]`;
        els.wordScopeFilterBar.style.display = "none";
    } else {
        // 全局：显示过滤后的动画组
        const all_groups = config ? config.word_anim_groups : [];
        const filtered = filterGroups(all_groups, word_scope_filter);
        const preferred = getPreferredScope(word_scope_filter);
        els.wordEditor.load(filtered, { disableScope: false, preferredScope: preferred });
        els.wordTitle.textContent = "全局字动画组";
        els.wordScopeFilterBar.style.display = "";
    }
}

/**
 * 更新默认动画组编辑器的数据和模式
 * 当默认配置为空时自动隐藏整个区块
 */
function updateDefaultEditors() {
    const line_groups = defaultAnimConfig ? defaultAnimConfig.line_anim_groups : [];
    const word_groups = defaultAnimConfig ? defaultAnimConfig.word_anim_groups : [];

    // 根据当前编辑状态决定加载模式
    const line_state = defaultStates.line;
    const line_opts = line_state.editingEnabled
        ? { readOnly: false, lockStructure: true }
        : { readOnly: true, lockStructure: true };
    els.lineDefaultEditor.load(line_groups, line_opts);

    const word_state = defaultStates.word;
    const word_opts = word_state.editingEnabled
        ? { readOnly: false, lockStructure: true }
        : { readOnly: true, lockStructure: true };
    els.wordDefaultEditor.load(word_groups, word_opts);

    // 默认配置为空时隐藏整个默认区块，有数据时显示
    const line_has_data = line_groups.length > 0;
    const word_has_data = word_groups.length > 0;
    els.lineDefaultSection.title.classList.toggle("hidden", !line_has_data);
    els.lineDefaultSection.body.classList.toggle("hidden", !line_has_data);
    els.wordDefaultSection.title.classList.toggle("hidden", !word_has_data);
    els.wordDefaultSection.body.classList.toggle("hidden", !word_has_data);
}

/**
 * 重置默认区块到折叠只读状态
 */
function resetDefaultSection(section, state) {
    state.editingEnabled = false;
    section.body.style.display = "none";
    section.icon.textContent = "▶";
    section.badge.textContent = "只读";
    section.badge.className = "default-badge";
}

/**
 * 发出自定义配置变更事件
 */
function emitConfigChanged() {
    const new_config = {
        line_anim_groups: config ? config.line_anim_groups : [],
        word_anim_groups: config ? config.word_anim_groups : [],
    };
    config = new_config;
    bus.emit("config:changed", new_config);
}

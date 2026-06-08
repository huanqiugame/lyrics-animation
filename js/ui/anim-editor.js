/**
 * 动画组编辑器
 * 可复用的 UI 组件，用于编辑 AnimationGroup 列表
 * 支持增删动画组、编辑时间锚点、管理通道
 *
 * 用法:
 *   const editor = createAnimEditor(container);
 *   editor.load(groups, { word, line });      // 加载数据
 *   editor.onChange((groups) => { ... });      // 监听变更
 *   editor.getData();                          // 获取当前数据
 */

import { h, clear } from "../utils/dom.js";
import { listChannels } from "../animation/channels.js";
import { EASING_PRESETS } from "../animation/easing.js";

/**
 * @typedef {import("../ttml/types.js").AnimationGroup} AnimationGroup
 * @typedef {import("../ttml/types.js").TimeAnchor} TimeAnchor
 * @typedef {import("../ttml/types.js").AnimChannel} AnimChannel
 */

// ---- 下拉选项常量 ----

const ANCHOR_REFS = [
    ["wordStart", "字开始"],
    ["wordEnd", "字结束"],
    ["lineStart", "行开始"],
    ["lineEnd", "行结束"],
];

const ANCHOR_DIRS = [
    ["before", "之前"],
    ["after", "之后"],
];

// ---- 编辑器工厂 ----

/**
 * 创建动画组编辑器实例
 * @param {HTMLElement} container - 放置编辑器的容器
 * @returns {{ load: Function, getData: Function, onChange: Function }}
 */
export function createAnimEditor(container) {
    /** @type {AnimationGroup[]} */
    let groups = [];

    /** @type {Function|null} */
    let change_callback = null;

    // 折叠状态追踪（WeakMap 避免污染数据模型，对象引用不变则状态持续）
    const groupCollapsedMap = new WeakMap();
    const channelCollapsedMap = new WeakMap();

    // 编辑模式控制
    // readOnly=true: 所有输入禁用，按钮隐藏（查看模式）
    // lockStructure=true: 隐藏增/删按钮和拖拽，但输入可用（可编辑值但不可改结构）
    let readOnly = false;
    let lockStructure = false;

    // 焦点管理状态
    let focused_group_index = -1;
    let focused_channel_index = -1; // -1 表示焦点在组级别

    // 预生成通道选项列表
    const channel_options = buildChannelOptions();
    const easing_options = buildEasingOptions();

    // ---- 渲染 ----

    function render() {
        const scroll_top = container.scrollTop;
        clear(container);

        if (groups.length === 0 && !readOnly) {
            container.appendChild(
                h("div", { className: "anim-editor-empty" }, "暂无动画组，点击下方按钮添加"),
            );
        }

        for (let i = 0; i < groups.length; i++) {
            container.appendChild(buildGroupCard(i, groups[i]));
        }

        if (!lockStructure && !readOnly) {
            container.appendChild(
                h("button", { className: "btn-add-group", type: "button" }, "+ 添加动画组"),
            ).addEventListener("click", () => {
                groups.push(createEmptyGroup());
                notifyChange();
                render();
            });
        }

        container.scrollTop = scroll_top;
        restoreFocus();
    }

    // ---- 构建单个动画组卡片 ----

    /**
     * @param {number} index
     * @param {AnimationGroup} group
     * @returns {HTMLElement}
     */
    function buildGroupCard(index, group) {
        const card = h("div", { className: "anim-group-card" });

        // 表头：拖拽手柄 + 折叠按钮 + 可编辑标题 + 注释图标 + 删除按钮
        const group_handle = h("span", { className: "drag-handle" }, "⠿");
        if (readOnly || lockStructure) {
            group_handle.style.display = "none";
        }
        const collapse_group_btn = h("span", { className: "collapse-icon" }, "▼");

        // 可编辑标题
        const group_name_text = group.name || `动画组 ${index + 1}`;
        const title_el = h("span", { className: "anim-group-title", title: "点击修改名称" }, group_name_text);
        if (!readOnly && !lockStructure) {
            title_el.addEventListener("click", () => {
                if (title_el.contentEditable === "true") return;
                title_el.contentEditable = "true";
                title_el.classList.add("editing");
                const range = document.createRange();
                range.selectNodeContents(title_el);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                title_el.focus();
            });
            title_el.addEventListener("blur", () => {
                title_el.contentEditable = "false";
                title_el.classList.remove("editing");
                const text = title_el.textContent.trim();
                group.name = text;
                title_el.textContent = text || `动画组 ${index + 1}`;
                notifyChange();
            });
            title_el.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    title_el.blur();
                }
            });
        }

        // 注释图标
        const annot_icon = h("span", {
            className: "annot-icon" + (group.note ? " has-note" : ""),
            title: "注释",
        });
        const pen_el = h("span", { className: "annot-pen" });
        pen_el.innerHTML = `<svg viewBox="0 0 77.8514 77.5959" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M13.3398 73.1485L66.6112 19.9259L58.0663 11.3321L4.74601 64.5548L0.10734 75.4434C-0.380941 76.6153 0.88859 77.9825 2.06047 77.4942ZM70.9081 15.7266L75.8398 10.8927C78.33 8.40242 78.4765 5.71688 76.2304 3.47078L74.5702 1.81063C72.373-0.386639 69.6874-0.191327 67.1972 2.25008L62.2655 7.13289Z" fill="currentColor"/></svg>`;
        const doc_el = h("span", { className: "annot-doc" });
        doc_el.innerHTML = `<svg viewBox="0 0 107.617 107.275" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M30.0293 107.275C32.4219 107.275 34.082 106.006 37.0605 103.369L53.9062 88.3789L85.2539 88.3789C99.8047 88.3789 107.617 80.3223 107.617 66.0156L107.617 28.6133C107.617 14.3066 99.8047 6.25 85.2539 6.25L22.3633 6.25C7.8125 6.25 0 14.2578 0 28.6133L0 66.0156C0 80.3711 7.8125 88.3789 22.3633 88.3789L24.707 88.3789L24.707 101.074C24.707 104.834 26.6113 107.275 30.0293 107.275ZM32.0312 98.3398L32.0312 84.1797C32.0312 81.543 31.0059 80.5176 28.3691 80.5176L22.3633 80.5176C12.5 80.5176 7.86133 75.4883 7.86133 65.9668L7.86133 28.6133C7.86133 19.0918 12.5 14.1113 22.3633 14.1113L85.2539 14.1113C95.0684 14.1113 99.7559 19.0918 99.7559 28.6133L99.7559 65.9668C99.7559 75.4883 95.0684 80.5176 85.2539 80.5176L53.6133 80.5176C50.8789 80.5176 49.5117 80.9082 47.6562 82.8125Z" fill="currentColor"/><path d="M28.6621 33.8379L78.3691 33.8379C79.9316 33.8379 81.1523 32.6172 81.1523 31.0059C81.1523 29.4922 79.9316 28.2227 78.3691 28.2227L28.6621 28.2227C27.0996 28.2227 25.8301 29.4922 25.8301 31.0059C25.8301 32.6172 27.0996 33.8379 28.6621 33.8379Z" fill="currentColor"/><path d="M28.6621 49.7559L78.3691 49.7559C79.9316 49.7559 81.1523 48.4863 81.1523 46.875C81.1523 45.3613 79.9316 44.0918 78.3691 44.0918L28.6621 44.0918C27.0996 44.0918 25.8301 45.3613 25.8301 46.875C25.8301 48.4863 27.0996 49.7559 28.6621 49.7559Z" fill="currentColor"/><path d="M28.6621 65.625L60.9863 65.625C62.5488 65.625 63.7695 64.4043 63.7695 62.8418C63.7695 61.2305 62.5488 59.9609 60.9863 59.9609L28.6621 59.9609C27.0996 59.9609 25.8301 61.2305 25.8301 62.8418C25.8301 64.4043 27.0996 65.625 28.6621 65.625Z" fill="currentColor"/></svg>`;
        annot_icon.appendChild(pen_el);
        annot_icon.appendChild(doc_el);
        annot_icon.addEventListener("click", () => {
            showAnnotationModal(group, () => { notifyChange(); render(); });
        });

        const header_children = [group_handle, collapse_group_btn, title_el, annot_icon];
        if (!readOnly && !lockStructure) {
            const del_btn = h("button", { className: "btn-icon btn-remove-group", type: "button", title: "删除该组" }, "×");
            del_btn.addEventListener("click", () => {
                groups.splice(index, 1);
                notifyChange();
                render();
            });
            header_children.push(del_btn);
        }
        const header = h("div", { className: "anim-group-header" }, ...header_children);
        collapse_group_btn.addEventListener("click", () => {
            card.classList.toggle("collapsed");
            const is_collapsed = card.classList.contains("collapsed");
            collapse_group_btn.textContent = is_collapsed ? "▶" : "▼";
            groupCollapsedMap.set(group, is_collapsed);
        });

        // 时间锚点
        const body = h("div", { className: "anim-group-body" });

        body.appendChild(buildAnchorRow("开始", group.start, (updated) => {
            group.start = updated;
            notifyChange();
        }));

        body.appendChild(buildAnchorRow("结束", group.end, (updated) => {
            group.end = updated;
            notifyChange();
        }));

        // 通道列表
        const channels_section = h("div", { className: "anim-channels-section" });
        const channels_header = h("div", { className: "anim-channels-header" },
            h("span", {}, "通道"),
        );
        channels_section.appendChild(channels_header);

        if (group.channels.length === 0) {
            channels_section.appendChild(
                h("div", { className: "anim-editor-empty" }, "暂无通道"),
            );
        }

        for (let ci = 0; ci < group.channels.length; ci++) {
            channels_section.appendChild(buildChannelRow(index, ci, group.channels, group));
        }

        if (!readOnly && !lockStructure) {
            const add_channel_btn = h("button", { className: "btn-icon btn-add-channel", type: "button" }, "+ 添加通道");
            add_channel_btn.addEventListener("click", () => {
                group.channels.push(createEmptyChannel());
                notifyChange();
                render();
            });
            channels_section.appendChild(add_channel_btn);
        }

        body.appendChild(channels_section);
        card.appendChild(header);
        card.appendChild(body);

        // 还原折叠状态
        if (groupCollapsedMap.get(group)) {
            card.classList.add("collapsed");
            collapse_group_btn.textContent = "▶";
        }

        if (!readOnly && !lockStructure) {
            makeGroupDraggable(group_handle, card, index);
        }
        return card;
    }

    // ---- 时间锚点行 ----

    /**
     * @param {string} label - "开始" 或 "结束"
     * @param {TimeAnchor} anchor
     * @param {Function} on_change
     * @returns {HTMLElement}
     */
    function buildAnchorRow(label, anchor, on_change) {
        const ref_select = createSelectOptions(anchor.ref, ANCHOR_REFS);
        const dir_select = createSelectOptions(anchor.dir, ANCHOR_DIRS);
        if (readOnly) {
            ref_select.disabled = true;
            dir_select.disabled = true;
        }
        const is_infinite = anchor.offset === null;
        const offset_attrs = {
            type: "number", min: 0,
            value: is_infinite ? "" : anchor.offset,
            className: "anim-offset",
            placeholder: is_infinite ? "∞" : "",
        };
        if (is_infinite || readOnly) offset_attrs.disabled = "";
        const offset_input = h("input", offset_attrs);
        const ms_label = h("span", { className: "anim-unit" }, "ms");
        const infinite_btn = h("button", {
            className: "btn-icon" + (is_infinite ? " infinite-active" : ""),
            type: "button", title: "切换无限/偏移模式",
        }, is_infinite ? "∞" : "±");
        if (readOnly) {
            infinite_btn.disabled = true;
        }

        function emitChange() {
            on_change({
                ref: ref_select.value,
                dir: dir_select.value,
                offset: offset_input.disabled ? null : (Number(offset_input.value) || 0),
            });
        }

        infinite_btn.addEventListener("click", () => {
            const was_disabled = offset_input.disabled;
            offset_input.disabled = !was_disabled;
            if (was_disabled) {
                // 切换到偏移模式
                offset_input.value = "0";
                offset_input.placeholder = "";
                infinite_btn.textContent = "±";
                infinite_btn.classList.remove("infinite-active");
            } else {
                // 切换到无限模式
                offset_input.value = "";
                offset_input.placeholder = "∞";
                infinite_btn.textContent = "∞";
                infinite_btn.classList.add("infinite-active");
            }
            emitChange();
        });

        ref_select.addEventListener("change", emitChange);
        dir_select.addEventListener("change", emitChange);
        offset_input.addEventListener("change", emitChange);

        return h("div", { className: "anim-anchor-row" },
            h("span", { className: "anim-anchor-label" }, label),
            ref_select,
            dir_select,
            offset_input,
            ms_label,
            infinite_btn,
        );
    }

    // ---- 通道行 ----

    /**
     * @param {number} group_index
     * @param {number} channel_index
     * @param {AnimChannel[]} channels_arr
     * @param {AnimationGroup} group
     * @returns {HTMLElement}
     */
    function buildChannelRow(group_index, channel_index, channels_arr, group) {
        const ch = channels_arr[channel_index];

        // 为折叠显示查找通道中文名
        const ch_label = (() => {
            for (const [val, label] of channel_options) {
                if (val === ch.channel_id) return label;
            }
            return ch.channel_id;
        })();

        const collapse_chan_btn = h("span", { className: "collapse-icon" }, "▼");
        const chan_name = h("span", { className: "chan-name" }, ch_label);
        const ch_select = createSelectOptions(ch.channel_id, channel_options);
        const from_input = h("input", { type: "text", value: String(ch.from ?? ""), className: "anim-chan-val", placeholder: "从" });
        const to_input = h("input", { type: "text", value: String(ch.to ?? ""), className: "anim-chan-val", placeholder: "到" });
        const curve_select = createSelectOptions(ch.curve, easing_options);

        if (readOnly) {
            ch_select.disabled = true;
            from_input.disabled = true;
            to_input.disabled = true;
            curve_select.disabled = true;
        }

        function emitChange() {
            channels_arr[channel_index] = {
                channel_id: ch_select.value,
                from: parseValue(ch_select.value, from_input.value),
                to: parseValue(ch_select.value, to_input.value),
                curve: curve_select.value,
            };
            notifyChange();
        }

        ch_select.addEventListener("change", () => {
            if (ch_select.disabled) return;
            // 切换通道时，用该通道的默认值填充 from/to
            const ch_info = getChannelInfo(ch_select.value);
            from_input.value = String(ch_info.default_from ?? "");
            to_input.value = String(ch_info.default_to ?? "");
            // 同时更新折叠时的显示名
            for (const [val, label] of channel_options) {
                if (val === ch_select.value) { chan_name.textContent = label; break; }
            }
            emitChange();
        });
        from_input.addEventListener("change", () => { if (!from_input.disabled) emitChange(); });
        to_input.addEventListener("change", () => { if (!to_input.disabled) emitChange(); });
        curve_select.addEventListener("change", () => { if (!curve_select.disabled) emitChange(); });

        collapse_chan_btn.addEventListener("click", () => {
            row.classList.toggle("collapsed");
            const is_collapsed = row.classList.contains("collapsed");
            collapse_chan_btn.textContent = is_collapsed ? "▶" : "▼";
            channelCollapsedMap.set(ch, is_collapsed);
        });

        const chan_handle = h("span", { className: "drag-handle" }, "⠿");
        if (readOnly || lockStructure) {
            chan_handle.style.display = "none";
        }
        const top_row_children = [chan_handle, collapse_chan_btn, chan_name, ch_select];
        if (!readOnly && !lockStructure) {
            const remove_btn = h("button", { className: "btn-icon btn-remove-chan", type: "button", title: "删除通道" }, "×");
            remove_btn.addEventListener("click", () => {
                channels_arr.splice(channel_index, 1);
                notifyChange();
                render();
            });
            top_row_children.push(remove_btn);
        }
        const top_row = h("div", { className: "chan-top-row" }, ...top_row_children);
        const bottom_row = h("div", { className: "chan-bottom-row" },
            h("span", { className: "anim-chan-label" }, "从"),
            from_input,
            h("span", { className: "anim-chan-label" }, "到"),
            to_input,
            h("span", { className: "anim-chan-label" }, "曲线"),
            curve_select,
        );
        const row = h("div", { className: "anim-channel-row" }, top_row, bottom_row);

        // 还原折叠状态
        if (channelCollapsedMap.get(ch)) {
            row.classList.add("collapsed");
            collapse_chan_btn.textContent = "▶";
        }

        if (!readOnly && !lockStructure) {
            makeChannelRowDraggable(chan_handle, row, channel_index, channels_arr, group_index);
        }
        return row;
    }

    // ---- 通知变更 ----

    function notifyChange() {
        if (change_callback) {
            change_callback(groups);
        }
    }


    // ---- 拖拽排序 ----

    /**
     * 检查 dataTransfer 中是否包含指定 MIME 类型
     * 用于在 dragenter/dragover 中区分组拖拽和通道拖拽
     */
    function hasDragType(e, mime) {
        const types = e.dataTransfer && e.dataTransfer.types;
        return types && Array.from(types).indexOf(mime) !== -1;
    }

    /**
     * 为组卡片添加拖拽排序能力
     * 越靠上（索引小）优先级越高
     * 使用独立 MIME 类型 text/x-anim-group 与通道拖拽隔离
     */
    function makeGroupDraggable(handle, card, index) {
        handle.draggable = true;

        handle.addEventListener("dragstart", (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/x-anim-group", String(index));
            // 整个卡片作为拖拽幽灵图
            const rect = card.getBoundingClientRect();
            e.dataTransfer.setDragImage(card, e.clientX - rect.left, e.clientY - rect.top);
            card.classList.add("dragging");
        });

        handle.addEventListener("dragend", () => {
            card.classList.remove("dragging");
            document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
        });

        card.addEventListener("dragenter", (e) => {
            if (hasDragType(e, "text/x-anim-group")) {
                card.classList.add("drag-over");
            }
        });

        card.addEventListener("dragover", (e) => {
            if (hasDragType(e, "text/x-anim-group")) {
                e.preventDefault();
            }
        });

        card.addEventListener("dragleave", () => {
            card.classList.remove("drag-over");
        });

        card.addEventListener("drop", (e) => {
            e.preventDefault();
            card.classList.remove("drag-over");
            const raw = e.dataTransfer.getData("text/x-anim-group");
            if (raw === "") return;
            const from_idx = parseInt(raw);
            if (from_idx === index) return;

            const [moved] = groups.splice(from_idx, 1);
            const adjusted = from_idx < index ? index - 1 : index;
            groups.splice(adjusted, 0, moved);
            notifyChange();
            render();
        });
    }

    /**
     * 为通道行添加拖拽排序能力
     * 使用独立 MIME 类型 text/x-anim-channel 与组拖拽隔离
     * 仅允许同组内的通道重排
     */
    function makeChannelRowDraggable(handle, row, channel_index, channels_arr, group_index) {
        handle.draggable = true;

        handle.addEventListener("dragstart", (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/x-anim-channel", group_index + ":" + channel_index);
            // 整个通道行作为拖拽幽灵图
            const rect = row.getBoundingClientRect();
            e.dataTransfer.setDragImage(row, e.clientX - rect.left, e.clientY - rect.top);
            row.classList.add("dragging");
        });

        handle.addEventListener("dragend", () => {
            row.classList.remove("dragging");
            document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
        });

        row.addEventListener("dragenter", (e) => {
            if (hasDragType(e, "text/x-anim-channel")) {
                row.classList.add("drag-over");
            }
        });

        row.addEventListener("dragover", (e) => {
            if (hasDragType(e, "text/x-anim-channel")) {
                e.preventDefault();
            }
        });

        row.addEventListener("dragleave", () => {
            row.classList.remove("drag-over");
        });

        row.addEventListener("drop", (e) => {
            e.preventDefault();
            row.classList.remove("drag-over");
            const raw = e.dataTransfer.getData("text/x-anim-channel");
            if (raw === "") return;
            const parts = raw.split(":");
            if (parts.length !== 2) return;
            const src_group = parseInt(parts[0]);
            const src_ch = parseInt(parts[1]);
            // 仅同组通道可重排
            if (src_group !== group_index) return;
            if (src_ch === channel_index) return;

            const [moved] = channels_arr.splice(src_ch, 1);
            const adjusted = src_ch < channel_index ? channel_index - 1 : channel_index;
            channels_arr.splice(adjusted, 0, moved);
            notifyChange();
            render();
        });
    }
    // ---- 焦点管理 ----

    /**
     * 设置焦点到指定组/通道
     * @param {number} group_idx
     * @param {number} [channel_idx=-1] -1 表示组级别
     */
    function setFocus(group_idx, channel_idx = -1) {
        focused_group_index = group_idx;
        focused_channel_index = channel_idx;
        updateFocusVisuals();
    }

    /**
     * 清除所有焦点
     */
    function clearFocus() {
        focused_group_index = -1;
        focused_channel_index = -1;
        updateFocusVisuals();
    }

    /**
     * 更新 DOM 焦点样式（增量更新，不 re-render）
     */
    function updateFocusVisuals() {
        // 清除旧焦点
        container.querySelectorAll(".anim-group-card.focused, .anim-channel-row.focused").forEach((el) => {
            el.classList.remove("focused");
        });

        if (focused_group_index < 0 || focused_group_index >= groups.length) return;

        const cards = container.querySelectorAll(".anim-group-card");
        const card = cards[focused_group_index];
        if (!card) return;

        if (focused_channel_index >= 0) {
            // 焦点在通道上
            const rows = card.querySelectorAll(".anim-channel-row");
            if (rows[focused_channel_index]) {
                rows[focused_channel_index].classList.add("focused");
                if (rows[focused_channel_index].scrollIntoView) {
                    rows[focused_channel_index].scrollIntoView({ block: "nearest" });
                }
            }
        } else {
            // 焦点在组上
            card.classList.add("focused");
            if (card.scrollIntoView) {
                card.scrollIntoView({ block: "nearest" });
            }
        }
    }

    /**
     * 渲染后恢复焦点状态
     */
    function restoreFocus() {
        if (focused_group_index >= 0 && focused_group_index < groups.length) {
            // 验证通道索引是否仍然有效
            const group = groups[focused_group_index];
            if (focused_channel_index >= 0 && focused_channel_index >= group.channels.length) {
                focused_channel_index = -1; // 通道已不存在，回退到组级别
            }
            updateFocusVisuals();
        }
    }

    /**
     * 切换组的折叠状态
     * @param {number} group_idx
     */
    function toggleGroupCollapse(group_idx) {
        if (group_idx < 0 || group_idx >= groups.length) return;
        const group = groups[group_idx];
        const was_collapsed = groupCollapsedMap.get(group);
        groupCollapsedMap.set(group, !was_collapsed);
        render();
    }

    /**
     * 检查元素是否在输入框内
     */
    function isInputFocused() {
        const tag = document.activeElement?.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
            document.activeElement?.isContentEditable;
    }

    // ---- 键盘导航 ----
    container.addEventListener("keydown", (e) => {
        if (readOnly || groups.length === 0) return;
        // 输入框内的按键不拦截（除了 Escape）
        if (isInputFocused() && e.key !== "Escape") return;

        const is_ctrl = e.ctrlKey || e.metaKey;

        switch (e.key) {
            case "Tab": {
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+Tab: 上一个组
                    if (focused_group_index <= 0) {
                        setFocus(groups.length - 1);
                    } else {
                        setFocus(focused_group_index - 1);
                    }
                } else {
                    // Tab: 下一个组
                    if (focused_group_index < 0 || focused_group_index >= groups.length - 1) {
                        setFocus(0);
                    } else {
                        setFocus(focused_group_index + 1);
                    }
                }
                break;
            }

            case "ArrowDown": {
                e.preventDefault();
                if (focused_group_index < 0) {
                    setFocus(0);
                } else if (focused_channel_index >= 0) {
                    // 在通道内：下一个通道
                    const group = groups[focused_group_index];
                    if (focused_channel_index < group.channels.length - 1) {
                        setFocus(focused_group_index, focused_channel_index + 1);
                    }
                } else {
                    // 在组级别：如果组已展开且有通道，进入第一个通道
                    const group = groups[focused_group_index];
                    const card = container.querySelectorAll(".anim-group-card")[focused_group_index];
                    if (card && !card.classList.contains("collapsed") && group.channels.length > 0) {
                        setFocus(focused_group_index, 0);
                    }
                }
                break;
            }

            case "ArrowUp": {
                e.preventDefault();
                if (focused_group_index < 0) {
                    setFocus(groups.length - 1);
                } else if (focused_channel_index > 0) {
                    // 在通道内：上一个通道
                    setFocus(focused_group_index, focused_channel_index - 1);
                } else if (focused_channel_index === 0) {
                    // 在第一个通道：回到组级别
                    setFocus(focused_group_index, -1);
                } else {
                    // 在组级别：上一个组
                    if (focused_group_index > 0) {
                        setFocus(focused_group_index - 1);
                    }
                }
                break;
            }

            case "ArrowRight": {
                e.preventDefault();
                if (focused_group_index < 0) {
                    setFocus(0);
                } else if (focused_channel_index >= 0) {
                    // 在通道内：如果通道折叠，展开它
                    const group = groups[focused_group_index];
                    const ch = group.channels[focused_channel_index];
                    if (channelCollapsedMap.get(ch)) {
                        channelCollapsedMap.set(ch, false);
                        render();
                    }
                } else {
                    // 在组级别：如果组折叠，展开它
                    const group = groups[focused_group_index];
                    if (groupCollapsedMap.get(group)) {
                        groupCollapsedMap.set(group, false);
                        render();
                    }
                }
                break;
            }

            case "ArrowLeft": {
                e.preventDefault();
                if (focused_channel_index >= 0) {
                    // 在通道内：如果通道展开，折叠它；如果已折叠，回到组级别
                    const group = groups[focused_group_index];
                    const ch = group.channels[focused_channel_index];
                    if (channelCollapsedMap.get(ch)) {
                        setFocus(focused_group_index, -1);
                    } else {
                        channelCollapsedMap.set(ch, true);
                        render();
                    }
                } else if (focused_group_index >= 0) {
                    // 在组级别：如果组展开，折叠它
                    const group = groups[focused_group_index];
                    if (!groupCollapsedMap.get(group)) {
                        groupCollapsedMap.set(group, true);
                        render();
                    }
                }
                break;
            }

            case "Enter": {
                e.preventDefault();
                if (focused_group_index >= 0) {
                    toggleGroupCollapse(focused_group_index);
                }
                break;
            }

            case "Delete":
            case "Backspace": {
                if (is_ctrl) return; // Ctrl+Delete 不拦截，留给复制粘贴模块
                e.preventDefault();
                if (focused_channel_index >= 0) {
                    // 删除焦点通道
                    const group = groups[focused_group_index];
                    group.channels.splice(focused_channel_index, 1);
                    focused_channel_index = -1;
                    notifyChange();
                    render();
                } else if (focused_group_index >= 0) {
                    // 删除焦点组
                    groups.splice(focused_group_index, 1);
                    focused_group_index = Math.min(focused_group_index, groups.length - 1);
                    notifyChange();
                    render();
                }
                break;
            }

            case "Escape": {
                clearFocus();
                break;
            }
        }
    });

    // 点击组卡片时更新焦点
    container.addEventListener("click", (e) => {
        if (readOnly) return;
        const card = e.target.closest(".anim-group-card");
        if (!card) return;
        const cards = Array.from(container.querySelectorAll(".anim-group-card"));
        const idx = cards.indexOf(card);
        if (idx >= 0) {
            // 检查是否点击在通道行上
            const chan_row = e.target.closest(".anim-channel-row");
            if (chan_row) {
                const chan_rows = Array.from(card.querySelectorAll(".anim-channel-row"));
                const ci = chan_rows.indexOf(chan_row);
                setFocus(idx, ci);
            } else {
                setFocus(idx);
            }
        }
    });

    // ---- 公共 API ----

    return {
        /**
         * 加载动画组数据并渲染
         * @param {AnimationGroup[]} new_groups
         * @param {{readOnly?: boolean, lockStructure?: boolean}} [opts]
         */
        load(new_groups, opts) {
            if (opts) {
                if (opts.readOnly !== undefined) readOnly = opts.readOnly;
                if (opts.lockStructure !== undefined) lockStructure = opts.lockStructure;
            }
            groups = new_groups;
            render();
        },

        /**
         * 设置只读模式（禁用所有输入，隐藏增/删/拖拽按钮）
         * @param {boolean} v
         */
        setReadOnly(v) {
            readOnly = v;
            if (v) lockStructure = true; // 只读隐含结构锁定
            render();
        },

        /**
         * 设置结构锁定模式（隐藏增/删/拖拽按钮，但输入保持可编辑）
         * @param {boolean} v
         */
        setLockStructure(v) {
            lockStructure = v;
            render();
        },

        /**
         * 获取当前动画组数据
         * @returns {AnimationGroup[]}
         */
        getData() {
            return groups;
        },

        /**
         * 注册变更回调
         * @param {Function} cb
         */
        onChange(cb) {
            change_callback = cb;
        },

        /** 折叠全部动画组和通道 */
        collapseAll() {
            container.querySelectorAll(".anim-group-card").forEach((c, gi) => {
                c.classList.add("collapsed");
                const icon = c.querySelector(".anim-group-header .collapse-icon");
                if (icon) icon.textContent = "▶";
                groupCollapsedMap.set(groups[gi], true);
                const rows = c.querySelectorAll(".anim-channel-row");
                rows.forEach((r, ci) => {
                    r.classList.add("collapsed");
                    const icon2 = r.querySelector(".collapse-icon");
                    if (icon2) icon2.textContent = "▶";
                    const group = groups[gi];
                    if (group && group.channels[ci]) {
                        channelCollapsedMap.set(group.channels[ci], true);
                    }
                });
            });
        },

        /** 展开全部动画组和通道 */
        expandAll() {
            container.querySelectorAll(".anim-group-card").forEach((c, gi) => {
                c.classList.remove("collapsed");
                const icon = c.querySelector(".anim-group-header .collapse-icon");
                if (icon) icon.textContent = "▼";
                groupCollapsedMap.set(groups[gi], false);
                const rows = c.querySelectorAll(".anim-channel-row");
                rows.forEach((r, ci) => {
                    r.classList.remove("collapsed");
                    const icon2 = r.querySelector(".collapse-icon");
                    if (icon2) icon2.textContent = "▼";
                    const group = groups[gi];
                    if (group && group.channels[ci]) {
                        channelCollapsedMap.set(group.channels[ci], false);
                    }
                });
            });
        },
    };
}

// ==================== 注释模态框 ====================

/**
 * 打开注释编辑模态框
 * @param {import("../ttml/types.js").AnimationGroup} group
 * @param {Function} on_save - 保存后回调（含组已更新的数据）
 */
function showAnnotationModal(group, on_save) {
    const overlay = h("div", { className: "modal-overlay" });
    const modal = h("div", { className: "modal-box" });

    const close_btn = h("button", { className: "btn-icon", type: "button" }, "×");
    const header = h("div", { className: "modal-header" },
        h("span", { className: "modal-title" }, "动画组注释"),
        close_btn,
    );

    const name_input = h("input", {
        type: "text", className: "modal-input",
        value: group.name || "",
        placeholder: "动画组名称",
    });
    const note_input = h("textarea", {
        className: "modal-textarea",
        placeholder: "注释",
    }, group.note || "");

    const body = h("div", { className: "modal-body" },
        h("label", { className: "modal-label" }, "名称"),
        name_input,
        h("label", { className: "modal-label" }, "注释"),
        note_input,
    );

    const save_btn = h("button", { type: "button", className: "primary" }, "保存");
    const cancel_btn = h("button", { type: "button" }, "取消");
    const footer = h("div", { className: "modal-footer" },
        cancel_btn,
        save_btn,
    );

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    const initial_name = group.name || "";
    const initial_note = group.note || "";
    let is_dirty = false;

    function checkDirty() {
        is_dirty = name_input.value !== initial_name || note_input.value !== initial_note;
    }
    name_input.addEventListener("input", checkDirty);
    note_input.addEventListener("input", checkDirty);

    function cleanup() {
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", onKeyDown);
    }

    function doClose() {
        if (is_dirty) {
            showConfirmDialog("放弃修改？", "输入的修改将丢失。", cleanup);
        } else {
            cleanup();
        }
    }

    function doSave() {
        group.name = name_input.value.trim();
        group.note = note_input.value.trim();
        cleanup();
        on_save();
    }

    function onKeyDown(e) {
        if (e.key === "Escape") doClose();
    }

    close_btn.addEventListener("click", doClose);
    cancel_btn.addEventListener("click", doClose);
    save_btn.addEventListener("click", doSave);

    // 点击 overlay 背景关闭（仅当 mousedown 和 mouseup 都在 overlay 上时）
    // 避免拖拽 textarea 调整大小后松手时误关闭
    let mousedown_on_overlay = false;
    overlay.addEventListener("mousedown", (e) => {
        mousedown_on_overlay = (e.target === overlay);
    });
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay && mousedown_on_overlay) {
            doClose();
        }
    });

    document.addEventListener("keydown", onKeyDown);

    document.body.appendChild(overlay);
    name_input.focus();
}

/**
 * 简单确认对话框
 * @param {string} title
 * @param {string} message
 * @param {Function} on_confirm - 确认后回调
 */
function showConfirmDialog(title, message, on_confirm) {
    const overlay = h("div", { className: "modal-overlay" });
    const modal = h("div", { className: "modal-box confirm-box" });

    const header = h("div", { className: "modal-header" },
        h("span", { className: "modal-title" }, title),
    );

    const body = h("div", { className: "modal-body" },
        h("p", {}, message),
    );

    const cancel_btn = h("button", { type: "button" }, "取消");
    const discard_btn = h("button", { type: "button", className: "primary" }, "舍弃");
    const footer = h("div", { className: "modal-footer" },
        cancel_btn,
        discard_btn,
    );

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);

    function cleanup() {
        document.body.removeChild(overlay);
        document.removeEventListener("keydown", onKeyDown);
    }

    cancel_btn.addEventListener("click", cleanup);
    discard_btn.addEventListener("click", () => { cleanup(); on_confirm(); });
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) cleanup();
    });
    function onKeyDown(e) {
        if (e.key === "Escape") cleanup();
    }
    document.addEventListener("keydown", onKeyDown);

    document.body.appendChild(overlay);
}

// ==================== 工具函数 ====================

/**
 * 创建 `<select>` 并设置当前值
 * @param {string} current
 * @param {[string, string][]} options - [[value, label], ...]
 * @returns {HTMLSelectElement}
 */
function createSelectOptions(current, options) {
    const sel = document.createElement("select");
    for (const [value, label] of options) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        if (value === current) opt.selected = true;
        sel.appendChild(opt);
    }
    return sel;
}

/**
 * 生成通道下拉选项
 * @returns {[string, string][]}
 */
function buildChannelOptions() {
    const channels = listChannels();
    return channels.map((ch) => [ch.id, ch.label]);
}

/**
 * 获取通道信息（含默认值建议）
 * @param {string} id
 * @returns {{ default_from: *, default_to: * }}
 */
function getChannelInfo(id) {
    const channels = listChannels();
    const ch = channels.find((c) => c.id === id);
    if (!ch) return { default_from: "", default_to: "" };
    // 根据通道类型给出 from/to 建议
    switch (id) {
        case "opacity":
            return { default_from: 0, default_to: 1 };
        case "blur":
            return { default_from: 8, default_to: 0 };
        case "color":
        case "backgroundColor":
        case "borderColor":
            return { default_from: "#ffffff", default_to: "#000000" };
        case "textShadow":
            return { default_from: "none", default_to: "0 0 10px rgba(0,0,0,0.5)" };
        case "textStroke":
            return { default_from: "none", default_to: "1px #000" };
        case "fontWeight":
            return { default_from: 400, default_to: 700 };
        case "fontSize":
            return { default_from: 32, default_to: 48 };
        case "translateX":
        case "translateY":
            return { default_from: 0, default_to: 20 };
        case "translateZ":
            return { default_from: 0, default_to: 50 };
        case "rotateX":
        case "rotateY":
        case "rotateZ":
            return { default_from: 0, default_to: 360 };
        case "scale":
            return { default_from: 1, default_to: 1.5 };
        case "borderWidth":
            return { default_from: 0, default_to: 2 };
        case "borderRadius":
            return { default_from: 0, default_to: 8 };
        case "zIndex":
            return { default_from: 1, default_to: 10 };
        default:
            return { default_from: ch.defaultValue ?? "", default_to: "" };
    }
}

/**
 * 生成缓动曲线下拉选项
 * @returns {[string, string][]}
 */
function buildEasingOptions() {
    const opts = [];
    for (const [id, preset] of EASING_PRESETS) {
        opts.push([id, preset.label]);
    }
    return opts;
}

/**
 * 创建空的动画组
 * @returns {AnimationGroup}
 */
function createEmptyGroup() {
    return {
        name: "",
        note: "",
        start: { ref: "wordStart", dir: "before", offset: 200 },
        end: { ref: "wordStart", dir: "after", offset: 0 },
        channels: [],
    };
}

/**
 * 创建空的通道
 * @returns {AnimChannel}
 */
function createEmptyChannel() {
    return {
        channel_id: "opacity",
        from: 0,
        to: 1,
        curve: "linear",
    };
}

/**
 * 尝试解析值（数字保持数字类型）
 * @param {string} channel_id
 * @param {string} raw
 * @returns {*}
 */
function parseValue(channel_id, raw) {
    if (channel_id === "opacity" || channel_id === "blur" || channel_id === "fontWeight" ||
        channel_id === "fontSize" || channel_id === "scale" || channel_id === "borderWidth" ||
        channel_id === "borderRadius" || channel_id === "zIndex" ||
        channel_id.startsWith("translate") || channel_id.startsWith("rotate")) {
        const num = Number(raw);
        return isNaN(num) ? raw : num;
    }
    return raw;
}

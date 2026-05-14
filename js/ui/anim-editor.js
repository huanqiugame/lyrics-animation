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

    // 预生成通道选项列表
    const channel_options = buildChannelOptions();
    const easing_options = buildEasingOptions();

    // ---- 渲染 ----

    function render() {
        clear(container);

        if (groups.length === 0) {
            container.appendChild(
                h("div", { className: "anim-editor-empty" }, "暂无动画组，点击下方按钮添加"),
            );
        }

        for (let i = 0; i < groups.length; i++) {
            container.appendChild(buildGroupCard(i, groups[i]));
        }

        container.appendChild(
            h("button", { className: "btn-add-group", type: "button" }, "+ 添加动画组"),
        ).addEventListener("click", () => {
            groups.push(createEmptyGroup());
            notifyChange();
            render();
        });
    }

    // ---- 构建单个动画组卡片 ----

    /**
     * @param {number} index
     * @param {AnimationGroup} group
     * @returns {HTMLElement}
     */
    function buildGroupCard(index, group) {
        const card = h("div", { className: "anim-group-card" });

        // 表头：拖拽手柄 + 折叠按钮 + 编号 + 删除按钮
        const collapse_group_btn = h("span", { className: "collapse-icon" }, "▼");
        const header = h("div", { className: "anim-group-header" },
            h("span", { className: "drag-handle" }, "⠿"),
            collapse_group_btn,
            h("span", {}, `动画组 ${index + 1}`),
            h("button", { className: "btn-icon btn-remove-group", type: "button", title: "删除该组" }, "×"),
        );
        header.lastElementChild.addEventListener("click", () => {
            groups.splice(index, 1);
            notifyChange();
            render();
        });
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
            h("button", { className: "btn-icon btn-add-channel", type: "button" }, "+ 添加"),
        );
        channels_header.lastElementChild.addEventListener("click", () => {
            group.channels.push(createEmptyChannel());
            notifyChange();
            render();
        });
        channels_section.appendChild(channels_header);

        if (group.channels.length === 0) {
            channels_section.appendChild(
                h("div", { className: "anim-editor-empty" }, "暂无通道"),
            );
        }

        for (let ci = 0; ci < group.channels.length; ci++) {
            channels_section.appendChild(buildChannelRow(index, ci, group.channels, group));
        }

        body.appendChild(channels_section);
        card.appendChild(header);
        card.appendChild(body);

        // 还原折叠状态
        if (groupCollapsedMap.get(group)) {
            card.classList.add("collapsed");
            collapse_group_btn.textContent = "▶";
        }

        makeGroupDraggable(card, index);
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
        const is_infinite = anchor.offset === null;
        const offset_input = h("input", {
            type: "number", min: 0,
            value: is_infinite ? "" : anchor.offset,
            className: "anim-offset",
            disabled: is_infinite,
            placeholder: is_infinite ? "∞" : "",
        });
        const ms_label = h("span", { className: "anim-unit" }, "ms");
        const infinite_btn = h("button", {
            className: "btn-icon" + (is_infinite ? " infinite-active" : ""),
            type: "button", title: "切换无限/偏移模式",
        }, is_infinite ? "∞" : "±");

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
        const remove_btn = h("button", { className: "btn-icon btn-remove-chan", type: "button", title: "删除通道" }, "×");

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
        from_input.addEventListener("change", emitChange);
        to_input.addEventListener("change", emitChange);
        curve_select.addEventListener("change", emitChange);
        remove_btn.addEventListener("click", () => {
            channels_arr.splice(channel_index, 1);
            notifyChange();
            render();
        });

        collapse_chan_btn.addEventListener("click", () => {
            row.classList.toggle("collapsed");
            const is_collapsed = row.classList.contains("collapsed");
            collapse_chan_btn.textContent = is_collapsed ? "▶" : "▼";
            channelCollapsedMap.set(ch, is_collapsed);
        });

        const row = h("div", { className: "anim-channel-row" },
            h("span", { className: "drag-handle" }, "⠿"),
            collapse_chan_btn,
            chan_name,
            ch_select,
            h("span", { className: "anim-chan-label" }, "从"),
            from_input,
            h("span", { className: "anim-chan-label" }, "到"),
            to_input,
            h("span", { className: "anim-chan-label" }, "曲线"),
            curve_select,
            remove_btn,
        );

        // 还原折叠状态
        if (channelCollapsedMap.get(ch)) {
            row.classList.add("collapsed");
            collapse_chan_btn.textContent = "▶";
        }

        makeChannelRowDraggable(row, channel_index, channels_arr, group_index);
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
    function makeGroupDraggable(card, index) {
        card.draggable = true;

        card.addEventListener("dragstart", (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/x-anim-group", String(index));
            card.classList.add("dragging");
        });

        card.addEventListener("dragend", () => {
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
    function makeChannelRowDraggable(row, channel_index, channels_arr, group_index) {
        row.draggable = true;

        row.addEventListener("dragstart", (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/x-anim-channel", group_index + ":" + channel_index);
            row.classList.add("dragging");
        });

        row.addEventListener("dragend", () => {
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
    // ---- 公共 API ----

    return {
        /**
         * 加载动画组数据并渲染
         * @param {AnimationGroup[]} new_groups
         */
        load(new_groups) {
            groups = new_groups;
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

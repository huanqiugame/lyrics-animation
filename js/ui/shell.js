/**
 * 主布局外壳
 * 创建应用的整体 HTML 结构，返回各区域容器引用供其他组件挂载
 *
 * 布局: [歌词行 | 动画参数 | 预览]
 *        可拖拽 ↕   可拖拽 ↕
 */

import { h } from "../utils/dom.js";

/**
 * 初始化应用外壳，替换 body 内容为完整的编辑器布局
 * @returns {{ toolbar: HTMLElement, editorPanel: HTMLElement, previewPanel: HTMLElement, lyricListBox: HTMLElement, paramPanelBox: HTMLElement, paramToggle: HTMLElement, paramPanelContainer: HTMLElement, timelineBox: HTMLElement, playbackBar: HTMLElement }}
 */
export function createShell() {
    const app = h("div", { id: "app" });

    // ---- 顶部工具栏 ----
    const toolbar = h("div", { id: "toolbar", className: "toolbar" });

    const toolbar_left = h("div", { className: "toolbar-left" });
    const toolbar_center = h("div", { className: "toolbar-center" });
    const toolbar_right = h("div", { className: "toolbar-right" });

    toolbar.appendChild(toolbar_left);
    toolbar.appendChild(toolbar_center);
    toolbar.appendChild(toolbar_right);

    // ---- 主内容区（歌词行 | 动画参数 | 预览） ----
    const main_area = h("div", { id: "main-area" });

    // ---- 1. 左侧：歌词行面板 ----
    const editor_panel = h("div", { id: "editor-panel", className: "panel" });

    const lyric_list_box = h("div", { id: "lyric-list-box", className: "panel-section" });
    const lyric_list_header = h("div", { className: "panel-header" },
        h("span", {}, "歌词行"),
        h("span", { className: "hint" }, "从 TTML 文件导入"),
    );
    const lyric_list_content = h("div", { id: "lyric-list", className: "scroll-area" });
    lyric_list_box.appendChild(lyric_list_header);
    lyric_list_box.appendChild(lyric_list_content);

    editor_panel.appendChild(lyric_list_box);

    // ---- 2. 中间：动画参数面板 ----
    const param_panel_panel = h("div", { id: "param-panel-container", className: "panel" });

    const param_panel_box = h("div", { id: "param-panel-box", className: "panel-section" });
    const param_header = h("div", { id: "param-panel-toggle", className: "panel-header" },
        h("span", {}, "动画参数"),
    );
    const param_content = h("div", { id: "param-panel", className: "panel-body" });
    param_panel_box.appendChild(param_header);
    param_panel_box.appendChild(param_content);

    param_panel_panel.appendChild(param_panel_box);

    // ---- 可拖拽分隔线 ----
    let editor_width = 360;
    let param_width = 320;
    let active_divider = null;

    function dividerCSS() {
        return {
            width: "4px",
            flexShrink: "0",
            background: "var(--border)",
            cursor: "col-resize",
            position: "relative",
        };
    }

    const divider1 = h("div", { id: "panel-divider-1", className: "panel-divider" });
    const divider2 = h("div", { id: "panel-divider-2", className: "panel-divider" });

    function onDividerMouseDown(divider_el, e) {
        e.preventDefault();
        active_divider = divider_el;
        divider_el.classList.add("dragging");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }

    divider1.addEventListener("mousedown", (e) => onDividerMouseDown(divider1, e));
    divider2.addEventListener("mousedown", (e) => onDividerMouseDown(divider2, e));

    document.addEventListener("mousemove", (e) => {
        if (!active_divider) return;
        const rect = main_area.getBoundingClientRect();
        const x = e.clientX - rect.left;

        if (active_divider === divider1) {
            // 拖拽分隔线 1：调整歌词行面板宽度
            editor_width = Math.max(200, Math.min(x, rect.width * 0.55));
            editor_panel.style.width = editor_width + "px";
        } else if (active_divider === divider2) {
            // 拖拽分隔线 2：调整参数面板宽度（预览面板至少留 200px）
            const left_edge = editor_panel.offsetWidth + 4;
            const max_w = rect.width - left_edge - 4 - 200;
            param_width = Math.max(200, Math.min(x - left_edge, max_w));
            param_panel_panel.style.width = param_width + "px";
        }
    });

    document.addEventListener("mouseup", () => {
        if (!active_divider) return;
        active_divider.classList.remove("dragging");
        active_divider = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
    });

    // ---- 3. 右侧：预览面板 ----
    const preview_panel = h("div", { id: "preview-panel", className: "panel" });
    const preview_content = h("div", { id: "preview-content" },
        h("div", { id: "preview-placeholder", className: "placeholder" },
            "导入歌词和音频后可预览动画效果",
        ),
    );
    preview_panel.appendChild(preview_content);

    // ---- 组装主内容区 ----
    main_area.appendChild(editor_panel);
    main_area.appendChild(divider1);
    main_area.appendChild(param_panel_panel);
    main_area.appendChild(divider2);
    main_area.appendChild(preview_panel);

    // ---- 底部区域：时间轴 ----
    const timeline_box = h("div", { id: "timeline-box" });
    const timeline_header = h("div", { className: "panel-header" }, "时间轴");
    const timeline_canvas = h("canvas", { id: "timeline-canvas" });
    timeline_box.appendChild(timeline_header);
    timeline_box.appendChild(timeline_canvas);

    // ---- 播放控制条 ----
    const playback_bar = h("div", { id: "playback-bar" });
    playback_bar.innerHTML = `
        <button id="btn-play" class="play-btn" disabled title="播放/暂停 (Space)">▶</button>
        <span id="time-display" class="time-display">00:00.000 / 00:00.000</span>
        <input type="range" id="progress-bar" class="progress-bar" min="0" max="1000" value="0" disabled>
        <div class="volume-group">
            <label title="音量">&#x1F50A;</label>
            <input type="range" id="volume-slider" min="0" max="100" value="80" class="volume-slider">
        </div>
    `;

    // ---- 状态栏 ----
    const status_bar = h("div", { id: "status-bar" }, "就绪");

    // ---- 组装 ----
    app.appendChild(toolbar);
    app.appendChild(main_area);
    app.appendChild(timeline_box);
    app.appendChild(playback_bar);
    app.appendChild(status_bar);
    document.body.replaceChildren(app);

    return {
        toolbar,
        toolbarLeft: toolbar_left,
        toolbarCenter: toolbar_center,
        toolbarRight: toolbar_right,
        editorPanel: editor_panel,
        previewPanel: preview_panel,
        divider: divider1,
        previewContent: preview_content,
        lyricListBox: lyric_list_content,
        paramPanelBox: param_content,
        paramToggle: param_header,
        paramPanelContainer: param_panel_panel,
        timelineBox: timeline_box,
        timelineCanvas: timeline_canvas,
        playbackBar: playback_bar,
        statusBar: status_bar,
    };
}

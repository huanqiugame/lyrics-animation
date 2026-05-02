/**
 * 主布局外壳
 * 创建应用的整体 HTML 结构，返回各区域容器引用供其他组件挂载
 */

import { h } from "../utils/dom.js";

/**
 * 初始化应用外壳，替换 body 内容为完整的编辑器布局
 * @returns {{ toolbar: HTMLElement, editorPanel: HTMLElement, previewPanel: HTMLElement, lyricListBox: HTMLElement, paramPanelBox: HTMLElement, timelineBox: HTMLElement, playbackBar: HTMLElement }}
 */
export function createShell() {
	const app = h("div", { id: "app" });

	// ---- 顶部工具栏 ----
	const toolbar = h("div", { id: "toolbar", className: "toolbar" });

	const toolbarLeft = h("div", { className: "toolbar-left" });
	const toolbarCenter = h("div", { className: "toolbar-center" });
	const toolbarRight = h("div", { className: "toolbar-right" });

	toolbar.appendChild(toolbarLeft);
	toolbar.appendChild(toolbarCenter);
	toolbar.appendChild(toolbarRight);

	// ---- 主内容区（编辑 + 预览） ----
	const mainArea = h("div", { id: "main-area" });

	// 左侧编辑面板
	const editorPanel = h("div", { id: "editor-panel", className: "panel" });

	const lyricListBox = h("div", { id: "lyric-list-box", className: "panel-section" });
	const lyricListHeader = h("div", { className: "panel-header" },
		h("span", {}, "歌词行"),
		h("span", { className: "hint" }, "从 TTML 文件导入"),
	);
	const lyricListContent = h("div", { id: "lyric-list", className: "scroll-area" });
	lyricListBox.appendChild(lyricListHeader);
	lyricListBox.appendChild(lyricListContent);

	const paramPanelBox = h("div", { id: "param-panel-box", className: "panel-section collapsible collapsed" });
	const paramHeader = h("div", { id: "param-panel-toggle", className: "panel-header toggle" },
		h("span", {}, "动画参数"),
		h("span", { className: "arrow" }, "▶"),
	);
	const paramContent = h("div", { id: "param-panel", className: "panel-body" });
	paramContent.style.display = "none";
	paramPanelBox.appendChild(paramHeader);
	paramPanelBox.appendChild(paramContent);

	// 折叠/展开切换
	paramHeader.addEventListener("click", () => {
		const collapsed = paramPanelBox.classList.toggle("collapsed");
		paramContent.style.display = collapsed ? "none" : "block";
		paramHeader.querySelector(".arrow").textContent = collapsed ? "▶" : "▼";
	});

	editorPanel.appendChild(lyricListBox);
	editorPanel.appendChild(paramPanelBox);

	// 可拖拽分隔线（编辑区 ↔ 预览区）
	const divider = h("div", { id: "panel-divider" });
	let dragging = false;
	let editorWidth = 360;

	divider.addEventListener("mousedown", (e) => {
		e.preventDefault();
		dragging = true;
		divider.classList.add("dragging");
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
	});

	document.addEventListener("mousemove", (e) => {
		if (!dragging) return;
		const rect = mainArea.getBoundingClientRect();
		const w = e.clientX - rect.left;
		editorWidth = Math.max(200, Math.min(w, rect.width * 0.6));
		editorPanel.style.width = editorWidth + "px";
	});

	document.addEventListener("mouseup", () => {
		if (!dragging) return;
		dragging = false;
		divider.classList.remove("dragging");
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	});

	// 右侧预览面板
	const previewPanel = h("div", { id: "preview-panel", className: "panel" });
	const previewContent = h("div", { id: "preview-content" },
		h("div", { id: "preview-placeholder", className: "placeholder" },
			"导入歌词和音频后可预览动画效果",
		),
	);
	previewPanel.appendChild(previewContent);

	mainArea.appendChild(editorPanel);
	mainArea.appendChild(divider);
	mainArea.appendChild(previewPanel);

	// ---- 底部区域：时间轴 ----
	const timelineBox = h("div", { id: "timeline-box" });
	const timelineHeader = h("div", { className: "panel-header" }, "时间轴");
	const timelineCanvas = h("canvas", { id: "timeline-canvas" });
	timelineBox.appendChild(timelineHeader);
	timelineBox.appendChild(timelineCanvas);

	// ---- 播放控制条 ----
	const playbackBar = h("div", { id: "playback-bar" });
	playbackBar.innerHTML = `
		<button id="btn-play" class="play-btn" disabled title="播放/暂停 (Space)">▶</button>
		<span id="time-display" class="time-display">00:00.000 / 00:00.000</span>
		<input type="range" id="progress-bar" class="progress-bar" min="0" max="1000" value="0" disabled>
		<div class="volume-group">
			<label title="音量">&#x1F50A;</label>
			<input type="range" id="volume-slider" min="0" max="100" value="80" class="volume-slider">
		</div>
	`;

	// ---- 状态栏 ----
	const statusBar = h("div", { id: "status-bar" }, "就绪");

	// ---- 组装 ----
	app.appendChild(toolbar);
	app.appendChild(mainArea);
	app.appendChild(timelineBox);
	app.appendChild(playbackBar);
	app.appendChild(statusBar);
	document.body.replaceChildren(app);

	return {
		toolbar,
		toolbarLeft,
		toolbarCenter,
		toolbarRight,
		editorPanel,
		previewPanel,
		divider,
		previewContent,
		lyricListBox: lyricListContent,
		paramPanelBox: paramContent,
		paramToggle: paramHeader,
		timelineBox,
		timelineCanvas,
		playbackBar,
		statusBar,
	};
}

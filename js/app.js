/**
 * 应用入口 — 协调层
 * 初始化所有模块，连接事件总线，管理应用生命周期
 */

import { createShell } from "./ui/shell.js";
import { initFileIO } from "./ui/file-io.js";
import { initLyricList } from "./ui/lyric-list.js";
import { AudioEngine } from "./audio/engine.js";
import { initPlayback } from "./ui/playback.js";
import { AnimationRenderer } from "./animation/renderer.js";
import { initParamPanel } from "./ui/param-panel.js";
import { bus } from "./utils/events.js";

// ---- 初始化外壳 ----
const shell = createShell();

// ---- 初始化音频引擎 ----
const engine = new AudioEngine();

// ---- 初始化动画渲染器 ----
const renderer = new AnimationRenderer(shell.previewContent);

// ---- 初始化各功能模块 ----
initFileIO(shell.toolbarLeft, shell.statusBar);
initLyricList(shell.lyricListBox);
initPlayback(engine);
initParamPanel(shell.paramPanelBox);

// ---- 音频文件加载 ----
bus.on("file:audio", ({ file }) => {
    engine.load(file);
    shell.statusBar.textContent = `音频已加载: ${file.name}`;
});

bus.on("audio:loaded", ({ duration }) => {
    const total_sec = (duration / 1000).toFixed(1);
    shell.statusBar.textContent = `音频就绪 — 时长 ${total_sec}s，可开始预览`;
});

bus.on("audio:error", ({ message }) => {
    shell.statusBar.textContent = message;
});

// ---- 状态栏初始消息 ----
shell.statusBar.textContent = "就绪 — 请导入 TTML 歌词文件或拖拽文件到页面";

// ---- 未保存更改提醒 ----
let hasUnsavedChanges = false;

bus.on("lyrics:loaded", () => { hasUnsavedChanges = false; });
bus.on("lyrics:modified", () => { hasUnsavedChanges = true; });
bus.on("config:changed", () => { hasUnsavedChanges = true; });
bus.on("defaultConfig:changed", () => { hasUnsavedChanges = true; });

window.addEventListener("beforeunload", (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
    }
});

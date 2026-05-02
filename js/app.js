/**
 * 应用入口 — 协调层
 * 初始化所有模块，连接事件总线，管理应用生命周期
 */

import { createShell } from "./ui/shell.js";
import { initFileIO } from "./ui/file-io.js";
import { initLyricList } from "./ui/lyric-list.js";
import { AudioEngine } from "./audio/engine.js";
import { initPlayback } from "./ui/playback.js";
import { bus } from "./utils/events.js";

// ---- 初始化外壳 ----
const shell = createShell();

// ---- 初始化音频引擎 ----
const engine = new AudioEngine();

// ---- 初始化各功能模块 ----
initFileIO(shell.toolbarLeft, shell.statusBar);
initLyricList(shell.lyricListBox);
initPlayback(engine);

// ---- 音频文件加载 ----
bus.on("file:audio", ({ file }) => {
	engine.load(file);
	shell.statusBar.textContent = `音频已加载: ${file.name}`;
});

bus.on("audio:loaded", ({ duration }) => {
	const totalSec = (duration / 1000).toFixed(1);
	shell.statusBar.textContent = `音频就绪 — 时长 ${totalSec}s，可开始预览`;
});

bus.on("audio:error", ({ message }) => {
	shell.statusBar.textContent = message;
});

// ---- 状态栏初始消息 ----
shell.statusBar.textContent = "就绪 — 请导入 TTML 歌词文件或拖拽文件到页面";

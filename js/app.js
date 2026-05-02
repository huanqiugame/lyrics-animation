/**
 * 应用入口 — 协调层
 * 初始化所有模块，连接事件总线，管理应用生命周期
 */

import { createShell } from "./ui/shell.js";
import { initFileIO } from "./ui/file-io.js";
import { initLyricList } from "./ui/lyric-list.js";

// ---- 初始化外壳 ----
const shell = createShell();

// ---- 初始化各功能模块 ----
initFileIO(shell.toolbarLeft, shell.statusBar);
initLyricList(shell.lyricListBox);

// ---- 状态栏初始消息 ----
shell.statusBar.textContent = "就绪 — 请导入 TTML 歌词文件或拖拽文件到页面";

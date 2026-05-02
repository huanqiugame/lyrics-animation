/**
 * 文件导入导出 UI
 * 处理 TTML 文件拖拽、文件选择对话框、导出下载
 */

import { bus } from "../utils/events.js";
import { parseTTML } from "../ttml/parser.js";
import { writeTTML, downloadTTML } from "../ttml/writer.js";

/** @type {import("../ttml/types.js").ProjectData | null} */
let currentProject = null;

/**
 * 初始化文件 IO 功能
 * 在工具栏添加导入/导出按钮，设置拖拽事件
 *
 * @param {HTMLElement} toolbarLeft - 工具栏左区域
 * @param {HTMLElement} statusBar - 状态栏元素
 */
export function initFileIO(toolbarLeft, statusBar) {
	// ---- 隐藏的 file input ----
	const fileInput = document.createElement("input");
	fileInput.type = "file";
	fileInput.accept = ".ttml,.xml,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.webm";
	fileInput.style.display = "none";
	document.body.appendChild(fileInput);

	// ---- 导入按钮 ----
	const btnImport = document.createElement("button");
	btnImport.id = "btn-import";
	btnImport.className = "primary";
	btnImport.textContent = "导入 TTML";
	btnImport.addEventListener("click", () => fileInput.click());

	// ---- 导入音频按钮 ----
	const btnImportAudio = document.createElement("button");
	btnImportAudio.id = "btn-import-audio";
	btnImportAudio.textContent = "导入音频";
	btnImportAudio.addEventListener("click", () => fileInput.click());

	// ---- 导出按钮 ----
	const btnExport = document.createElement("button");
	btnExport.id = "btn-export";
	btnExport.textContent = "导出 TTML";
	btnExport.disabled = true;
	btnExport.addEventListener("click", () => {
		if (!currentProject) return;
		const ttml = writeTTML(currentProject);
		const name = currentProject.audioFileName
			? currentProject.audioFileName.replace(/\.[^.]+$/, "") + ".ttml"
			: "lyric.ttml";
		downloadTTML(ttml, name);
		setStatus("导出成功");
	});

	toolbarLeft.appendChild(btnImport);
	toolbarLeft.appendChild(btnImportAudio);
	toolbarLeft.appendChild(btnExport);

	// ---- 文件选择 ----
	fileInput.addEventListener("change", () => {
		if (fileInput.files[0]) handleFile(fileInput.files[0]);
	});

	// ---- 拖拽支持 ----
	let dragCounter = 0;
	const dropOverlay = document.createElement("div");
	dropOverlay.id = "drop-overlay";
	dropOverlay.textContent = "松开以导入文件（TTML / 音频）";
	document.body.appendChild(dropOverlay);

	document.addEventListener("dragover", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});

	document.addEventListener("dragenter", (e) => {
		e.preventDefault();
		dragCounter++;
		if (dragCounter === 1) dropOverlay.classList.add("visible");
	});

	document.addEventListener("dragleave", () => {
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			dropOverlay.classList.remove("visible");
		}
	});

	document.addEventListener("drop", (e) => {
		e.preventDefault();
		dragCounter = 0;
		dropOverlay.classList.remove("visible");
		const file = e.dataTransfer?.files?.[0];
		if (file) handleFile(file);
	});

	// ---- 保持项目引用 ----
	bus.on("lyrics:loaded", (project) => {
		currentProject = project;
		btnExport.disabled = false;
	});

	bus.on("lyrics:modified", (project) => {
		currentProject = project;
	});

	// ---- 状态栏辅助 ----
	function setStatus(msg) {
		statusBar.textContent = msg;
	}

	const AUDIO_EXTS = /\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i;

	// ---- 文件处理 ----
	function handleFile(file) {
		// 音频文件：发送事件到音频引擎
		if (AUDIO_EXTS.test(file.name)) {
			setStatus(`正在加载音频: ${file.name}...`);
			bus.emit("file:audio", { file });
			return;
		}

		if (!file.name.endsWith(".ttml") && !file.name.endsWith(".xml")) {
			setStatus("不支持的文件格式，请选择 .ttml 或音频文件");
			return;
		}
		setStatus(`正在解析: ${file.name}...`);
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const t0 = performance.now();
				const project = parseTTML(reader.result);
				const elapsed = (performance.now() - t0).toFixed(1);
				project.audioFileName = file.name.replace(/\.[^.]+$/, ".mp3");
				bus.emit("lyrics:loaded", project);
				setStatus(
					`解析完成: ${file.name} (${project.lyrics.length} 行, 耗时 ${elapsed}ms)`,
				);
			} catch (err) {
				setStatus(`解析失败: ${err.message}`);
				console.error(err);
			}
		};
		reader.onerror = () => setStatus("文件读取失败");
		reader.readAsText(file);
	}
}

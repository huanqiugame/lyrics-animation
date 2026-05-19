/**
 * 文件导入导出 UI
 * 处理 TTML 文件拖拽、文件选择对话框、导出下载
 */

import { bus } from "../utils/events.js";
import { parseTTML } from "../ttml/parser.js";
import { writeTTML, downloadTTML, downloadConfig, parseConfigJSON } from "../ttml/writer.js";
import { createEmptyConfig } from "../ttml/types.js";

/** @type {import("../ttml/types.js").ProjectData | null} */
let current_project = null;

/**
 * 初始化文件 IO 功能
 * 在工具栏添加导入/导出按钮，设置拖拽事件
 *
 * @param {HTMLElement} toolbar_left - 工具栏左区域
 * @param {HTMLElement} status_bar - 状态栏元素
 */
export function initFileIO(toolbar_left, status_bar) {
    // ---- 隐藏的 file input ----
    const file_input = document.createElement("input");
    file_input.type = "file";
    file_input.accept = ".ttml,.xml,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.webm";
    file_input.style.display = "none";
    document.body.appendChild(file_input);

    // ---- 隐藏的 file input (动画配置 JSON) ----
    const config_input = document.createElement("input");
    config_input.type = "file";
    config_input.accept = ".json";
    config_input.style.display = "none";
    document.body.appendChild(config_input);

    // ---- 导入按钮 ----
    const btn_import = document.createElement("button");
    btn_import.id = "btn-import";
    btn_import.className = "primary";
    btn_import.textContent = "导入 TTML";
    btn_import.addEventListener("click", () => file_input.click());

    // ---- 导入音频按钮 ----
    const btn_import_audio = document.createElement("button");
    btn_import_audio.id = "btn-import-audio";
    btn_import_audio.textContent = "导入音频";
    btn_import_audio.addEventListener("click", () => file_input.click());

    // ---- 导出按钮 ----
    const btn_export = document.createElement("button");
    btn_export.id = "btn-export";
    btn_export.textContent = "导出 TTML";
    btn_export.disabled = true;
    btn_export.addEventListener("click", () => {
        if (!current_project) return;
        const ttml = writeTTML(current_project);
        const name = current_project.audio_file_name
            ? current_project.audio_file_name.replace(/\.[^.]+$/, "") + ".ttml"
            : "lyric.ttml";
        downloadTTML(ttml, name);
        setStatus("导出成功");
    });

    // ---- 导入动画配置按钮 ----
    const btn_import_config = document.createElement("button");
    btn_import_config.id = "btn-import-config";
    btn_import_config.textContent = "导入动画配置";
    btn_import_config.title = "点击导入自定义动画配置 ｜ Alt/Option+点击导入默认动画配置";
    btn_import_config.addEventListener("click", (e) => {
        config_input.dataset.targetConfig = e.altKey ? "default" : "custom";
        config_input.click();
    });

    // ---- 导出动画配置按钮 ----
    const btn_export_config = document.createElement("button");
    btn_export_config.id = "btn-export-config";
    btn_export_config.textContent = "导出动画配置";
    btn_export_config.title = "点击导出自定义动画配置 ｜ Alt/Option+点击导出全部配置（默认+自定义合并）";
    btn_export_config.disabled = true;
    btn_export_config.addEventListener("click", (e) => {
        if (!current_project) return;
        if (e.altKey) {
            // 合并 default + custom 后导出
            const custom = current_project.anim_config || createEmptyConfig();
            const def = current_project.default_anim_config || createEmptyConfig();
            const merged = {
                line_anim_groups: [...custom.line_anim_groups, ...def.line_anim_groups],
                word_anim_groups: [...custom.word_anim_groups, ...def.word_anim_groups],
            };
            downloadConfig(merged, "animation-config-full.json");
            setStatus("全部动画配置（默认+自定义）已导出");
        } else {
            downloadConfig(current_project.anim_config, "animation-config.json");
            setStatus("自定义动画配置已导出");
        }
    });

    toolbar_left.appendChild(btn_import);
    toolbar_left.appendChild(btn_import_audio);
    toolbar_left.appendChild(btn_import_config);
    toolbar_left.appendChild(btn_export);
    toolbar_left.appendChild(btn_export_config);

    // ---- 文件选择 ----
    file_input.addEventListener("change", () => {
        if (file_input.files[0]) handleFile(file_input.files[0]);
    });

    // ---- 动画配置选择 ----
    config_input.addEventListener("change", () => {
        if (!config_input.files[0]) return;
        const file = config_input.files[0];
        const target = config_input.dataset.targetConfig || "custom";
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const parsed = parseConfigJSON(reader.result);
                if (target === "default") {
                    current_project.default_anim_config = parsed;
                    bus.emit("defaultConfig:changed", parsed);
                    setStatus("默认动画配置已导入");
                } else {
                    current_project.anim_config = parsed;
                    bus.emit("config:changed", parsed);
                    setStatus("自定义动画配置已导入");
                }
            } catch (err) {
                setStatus(`导入失败: ${err.message}`);
                console.error(err);
            }
        };
        reader.onerror = () => setStatus("文件读取失败");
        reader.readAsText(file);
    });

    // ---- 拖拽支持 ----
    let drag_counter = 0;
    const drop_overlay = document.createElement("div");
    drop_overlay.id = "drop-overlay";
    drop_overlay.textContent = "松开以导入文件（TTML / 音频）";
    document.body.appendChild(drop_overlay);

    document.addEventListener("dragover", (e) => {
        // 仅外部文件拖拽阻止默认行为，内部 DnD 正常传递
        const types = e.dataTransfer?.types;
        if (!types) return;
        const type_list = Array.from(types);
        if (!type_list.includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener("dragenter", (e) => {
        // 仅外部文件拖拽显示覆盖层，内部 DnD（动画组排序）忽略
        const types = e.dataTransfer?.types;
        if (!types) return;
        const type_list = Array.from(types);
        if (!type_list.includes("Files")) return;
        e.preventDefault();
        drag_counter++;
        if (drag_counter === 1) drop_overlay.classList.add("visible");
    });

    document.addEventListener("dragleave", () => {
        drag_counter--;
        if (drag_counter <= 0) {
            drag_counter = 0;
            drop_overlay.classList.remove("visible");
        }
    });

    document.addEventListener("drop", (e) => {
        drag_counter = 0;
        drop_overlay.classList.remove("visible");
        // 仅处理外部文件拖拽
        const types = e.dataTransfer?.types;
        if (!types) return;
        const type_list = Array.from(types);
        if (!type_list.includes("Files")) return;
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFile(file);
    });

    // ---- 保持项目引用 ----
    bus.on("lyrics:loaded", (project) => {
        current_project = project;
        btn_export.disabled = false;
        btn_export_config.disabled = false;
    });

    bus.on("lyrics:modified", (project) => {
        current_project = project;
    });

    // ---- 状态栏辅助 ----
    function setStatus(msg) {
        status_bar.textContent = msg;
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
                project.audio_file_name = file.name.replace(/\.[^.]+$/, ".mp3");
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

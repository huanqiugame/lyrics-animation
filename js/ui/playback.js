/**
 * 播放控制 UI
 * 将 DOM 控件连接到 AudioEngine，处理键盘快捷键
 */

import { bus } from "../utils/events.js";
import { msToTimestamp } from "../utils/time.js";

/**
 * 初始化播放控制
 * @param {import("../audio/engine.js").AudioEngine} engine
 */
export function initPlayback(engine) {
    const btn_play = document.getElementById("btn-play");
    const time_display = document.getElementById("time-display");
    const progress_bar = document.getElementById("progress-bar");
    const volume_slider = document.getElementById("volume-slider");

    let is_seeking = false;
    let duration = 0;

    // ---- 时间显示结构 ----
    // 将 time-display 拆分为：可点击的当前时间 + 分隔符 + 总时长
    const current_time_el = document.createElement("span");
    current_time_el.className = "time-current";
    current_time_el.style.cursor = "pointer";
    current_time_el.title = "点击跳转到指定时间";
    const separator_el = document.createTextNode(" / ");
    const total_time_el = document.createElement("span");
    time_display.textContent = "";
    time_display.appendChild(current_time_el);
    time_display.appendChild(separator_el);
    time_display.appendChild(total_time_el);

    function update_time_display(current_time) {
        current_time_el.textContent = msToTimestamp(current_time);
        total_time_el.textContent = msToTimestamp(duration);
    }

    // ---- 快速时间跳转 ----
    let is_editing_time = false;

    function showTimeInput() {
        if (is_editing_time || !engine.hasAudio) return;
        is_editing_time = true;

        const input = document.createElement("input");
        input.type = "text";
        input.className = "time-jump-input";
        input.value = current_time_el.textContent;
        input.style.width = current_time_el.offsetWidth + 4 + "px";

        current_time_el.replaceWith(input);
        input.focus();
        input.select();

        function commit() {
            const raw = input.value.trim();
            if (raw) {
                const ms = parseTimeInput(raw);
                if (ms !== null) {
                    engine.seek(Math.max(0, Math.min(ms, duration)));
                }
            }
            finish();
        }

        function finish() {
            is_editing_time = false;
            input.replaceWith(current_time_el);
            // 立即更新显示（audio:seeked 也会更新，但这里先更新避免闪烁）
            update_time_display(engine.currentTime);
        }

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                commit();
            } else if (e.key === "Escape") {
                e.preventDefault();
                finish();
            }
        });

        input.addEventListener("blur", () => {
            // 延迟处理，避免 blur 和 keydown 冲突
            setTimeout(() => {
                if (is_editing_time) commit();
            }, 50);
        });
    }

    current_time_el.addEventListener("click", showTimeInput);

    // ---- 播放/暂停按钮 ----
    btn_play.addEventListener("click", () => {
        if (!engine.hasAudio) return;
        engine.toggle();
    });

    bus.on("audio:play", () => {
        btn_play.textContent = "⏸";
    });

    bus.on("audio:pause", () => {
        btn_play.textContent = "▶";
    });

    // ---- 时间更新 ----
    bus.on("audio:timeupdate", ({ currentTime }) => {
        if (!is_seeking) {
            progress_bar.value = currentTime;
        }
        if (!is_editing_time) {
            update_time_display(currentTime);
        }
    });

    // ---- 音频加载完成 ----
    bus.on("audio:loaded", ({ duration: dur }) => {
        duration = dur;
        progress_bar.max = dur;
        progress_bar.value = 0;
        progress_bar.disabled = false;
        btn_play.disabled = false;
        update_time_display(0);
    });

    // ---- 进度条 ----
    progress_bar.addEventListener("mousedown", () => {
        is_seeking = true;
    });

    document.addEventListener("mouseup", () => {
        if (is_seeking) {
            is_seeking = false;
            engine.seek(Number(progress_bar.value));
        }
    });

    progress_bar.addEventListener("input", () => {
        if (is_seeking) {
            update_time_display(Number(progress_bar.value));
        }
    });

    // ---- 音量滑块 ----
    volume_slider.addEventListener("input", () => {
        engine.setVolume(Number(volume_slider.value));
    });

    // ---- 键盘快捷键 ----
    document.addEventListener("keydown", (e) => {
        // 空格键：播放/暂停（不在输入框中生效）
        if (e.code === "Space" && engine.hasAudio) {
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) {
                return;
            }
            e.preventDefault();
            engine.toggle();
        }
    });
}

/**
 * 解析时间输入字符串
 * 支持格式：MM:SS.mmm、SS.mmm、纯秒数（如 90.5）
 * @param {string} raw
 * @returns {number | null} 毫秒数，解析失败返回 null
 */
export function parseTimeInput(raw) {
    // 纯数字 → 当作秒数
    if (/^\d+(\.\d+)?$/.test(raw)) {
        const sec = parseFloat(raw);
        return Math.round(sec * 1000);
    }

    // MM:SS.mmm 或 MM:SS
    const match = raw.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (match) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms_str = match[3] || "0";
        const ms = parseInt(ms_str.padEnd(3, "0"), 10);
        return min * 60000 + sec * 1000 + ms;
    }

    return null;
}

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

    function update_time_display(current_time) {
        time_display.textContent = `${msToTimestamp(current_time)} / ${msToTimestamp(duration)}`;
    }

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
        update_time_display(currentTime);
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

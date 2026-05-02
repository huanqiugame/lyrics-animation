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
	const btnPlay = document.getElementById("btn-play");
	const timeDisplay = document.getElementById("time-display");
	const progressBar = document.getElementById("progress-bar");
	const volumeSlider = document.getElementById("volume-slider");

	let isSeeking = false;
	let duration = 0;

	function updateTimeDisplay(currentTime) {
		timeDisplay.textContent = `${msToTimestamp(currentTime)} / ${msToTimestamp(duration)}`;
	}

	// ---- 播放/暂停按钮 ----
	btnPlay.addEventListener("click", () => {
		if (!engine.hasAudio) return;
		engine.toggle();
	});

	bus.on("audio:play", () => {
		btnPlay.textContent = "⏸";
	});

	bus.on("audio:pause", () => {
		btnPlay.textContent = "▶";
	});

	// ---- 时间更新 ----
	bus.on("audio:timeupdate", ({ currentTime }) => {
		if (!isSeeking) {
			progressBar.value = currentTime;
		}
		updateTimeDisplay(currentTime);
	});

	// ---- 音频加载完成 ----
	bus.on("audio:loaded", ({ duration: dur }) => {
		duration = dur;
		progressBar.max = dur;
		progressBar.value = 0;
		progressBar.disabled = false;
		btnPlay.disabled = false;
		updateTimeDisplay(0);
	});

	// ---- 进度条 ----
	progressBar.addEventListener("mousedown", () => {
		isSeeking = true;
	});

	document.addEventListener("mouseup", () => {
		if (isSeeking) {
			isSeeking = false;
			engine.seek(Number(progressBar.value));
		}
	});

	progressBar.addEventListener("input", () => {
		if (isSeeking) {
			updateTimeDisplay(Number(progressBar.value));
		}
	});

	// ---- 音量滑块 ----
	volumeSlider.addEventListener("input", () => {
		engine.setVolume(Number(volumeSlider.value));
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

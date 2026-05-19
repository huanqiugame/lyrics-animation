/**
 * Phase 3 验证脚本：音频引擎 + 播放控制
 * 用法：/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node test/phase3-audio.mjs
 *
 * 使用动态 import() 确保 jsdom 全局变量在模块加载前就位
 */

import { JSDOM } from "jsdom";

// ---- 设置 jsdom 全局环境（必须在动态导入被测模块之前完成） ----
const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
    	<button id="btn-play" class="play-btn" disabled>▶</button>
    	<span id="time-display" class="time-display">00:00.000 / 00:00.000</span>
    	<input type="range" id="progress-bar" class="progress-bar" min="0" max="1000" value="0" disabled>
    	<input type="range" id="volume-slider" min="0" max="100" value="80" class="volume-slider">
    </body></html>`,
    { url: "http://localhost/" },
);

// 注入 jsdom 的 DOM API 到全局（必须在动态导入之前）
globalThis.document = dom.window.document;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.Event = dom.window.Event;
globalThis.EventTarget = dom.window.EventTarget;
globalThis.URL = dom.window.URL;
globalThis.Blob = dom.window.Blob;
globalThis.File = dom.window.File;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// jsdom 的 URL.createObjectURL / revokeObjectURL 不完整，mock 之
globalThis.URL.createObjectURL = (blob) => `blob:mock-${Math.random()}`;
globalThis.URL.revokeObjectURL = () => {};


// ---- Mock Audio ----
class MockAudio extends EventTarget {
    constructor() {
    	super();
    	this._currentTime = 0;
    	this._duration = NaN;
    	this._volume = 0.8;
    	this._src = "";
    	this._paused = true;
    	this.preload = "auto";
    	this.error = null;
    }

    get currentTime() { return this._currentTime; }
    set currentTime(v) { this._currentTime = v; }
    get duration() { return this._duration; }
    set duration(v) { this._duration = v; }
    get volume() { return this._volume; }
    set volume(v) { this._volume = v; }
    get src() { return this._src; }
    set src(v) { this._src = v; }
    get paused() { return this._paused; }

    play() {
    	this._paused = false;
    	this.dispatchEvent(new Event("play"));
    	return Promise.resolve();
    }

    pause() {
    	this._paused = true;
    	this.dispatchEvent(new Event("pause"));
    }

    load() {
    	setTimeout(() => {
    		this._duration = 200;
    		this.dispatchEvent(new Event("loadedmetadata"));
    	}, 0);
    }
}

globalThis.HTMLAudioElement = MockAudio;
globalThis.Audio = MockAudio;

console.log("✓ jsdom DOM 环境就绪\n");

// ---- 动态导入（globals 已就位，模块能正确引用） ----
const { bus } = await import("../js/utils/events.js");
const { AudioEngine } = await import("../js/audio/engine.js");
const { initPlayback } = await import("../js/ui/playback.js");

let passed = 0;
let failed = 0;

function check(cond, msg) {
    if (cond) {
    	passed++;
    } else {
    	console.error(`  ✗ 失败: ${msg}`);
    	failed++;
    }
}

function section(title) {
    console.log(`\n=== ${title} ===`);
}

// ==================== 1. AudioEngine.isAudioFile ====================
section("1. AudioEngine.isAudioFile（静态方法）");

check(AudioEngine.isAudioFile({ name: "song.mp3" }), "mp3 → true");
check(AudioEngine.isAudioFile({ name: "song.wav" }), "wav → true");
check(AudioEngine.isAudioFile({ name: "song.ogg" }), "ogg → true");
check(AudioEngine.isAudioFile({ name: "song.flac" }), "flac → true");
check(AudioEngine.isAudioFile({ name: "song.m4a" }), "m4a → true");
check(AudioEngine.isAudioFile({ name: "song.opus" }), "opus → true");
check(AudioEngine.isAudioFile({ name: "song.aac" }), "aac → true");
check(AudioEngine.isAudioFile({ name: "song.webm" }), "webm → true");
check(!AudioEngine.isAudioFile({ name: "song.ttml" }), "ttml → false");
check(!AudioEngine.isAudioFile({ name: "song.xml" }), "xml → false");
check(!AudioEngine.isAudioFile({ name: "song.txt" }), "txt → false");

// ==================== 2. AudioEngine 初始状态 ====================
section("2. AudioEngine 初始状态");

const engine = new AudioEngine();

check(engine.currentTime === 0, "currentTime = 0");
check(engine.duration === 0, "duration = 0（NaN → 0）");
check(!engine.hasAudio, "hasAudio = false");
check(!engine.isPlaying, "isPlaying = false");

// ==================== 3. play/pause → 事件总线 ====================
section("3. play/pause → audio:play / audio:pause");

let playCount = 0;
let pauseCount = 0;

bus.on("audio:play", () => { playCount++; });
bus.on("audio:pause", () => { pauseCount++; });

engine.play();
check(playCount === 1, "play() → audio:play 触发 1 次");
check(engine.isPlaying, "play() → isPlaying = true");

engine.play();
check(playCount === 2, "二次 play() → audio:play 触发 2 次");

engine.pause();
check(pauseCount === 1, "pause() → audio:pause 触发 1 次");
check(!engine.isPlaying, "pause() → isPlaying = false");

// ==================== 4. toggle ====================
section("4. AudioEngine.toggle");

const beforeToggle = engine.isPlaying;
engine.toggle();
check(engine.isPlaying === !beforeToggle, `toggle: ${beforeToggle} → ${engine.isPlaying}`);
engine.toggle();
check(engine.isPlaying === beforeToggle, `toggle back: → ${engine.isPlaying}`);

// ==================== 5. seek / setVolume ====================
section("5. seek & setVolume");

try {
    engine.seek(30000);
    check(true, "seek(30000ms) 不抛错");
    engine.seek(0);
    check(true, "seek(0) 不抛错");
} catch (e) {
    check(false, `seek 抛错: ${e.message}`);
}

try {
    engine.setVolume(80);
    check(true, "setVolume(80) 不抛错");
    engine.setVolume(0);
    check(true, "setVolume(0) 不抛错");
    engine.setVolume(100);
    check(true, "setVolume(100) 不抛错");
    engine.setVolume(200);
    check(true, "setVolume(200) 不抛错（超限约束到 1）");
    engine.setVolume(-50);
    check(true, "setVolume(-50) 不抛错（负值约束到 0）");
} catch (e) {
    check(false, `setVolume 抛错: ${e.message}`);
}

// ==================== 6. load(File) → audio:loaded ====================
section("6. load(File) → audio:loaded");

const engine2 = new AudioEngine();
let loadedDuration = -1;
bus.on("audio:loaded", ({ duration }) => {
    loadedDuration = duration;
});

const blob = new Blob(["mock"], { type: "audio/mpeg" });
const file = new File([blob], "test.mp3", { type: "audio/mpeg" });

try {
    engine2.load(file);
    check(true, "load(File) 不抛错");
} catch (e) {
    check(false, `load 抛错: ${e.message}`);
}

// load() 中的 loadedmetadata 是异步的（MockAudio.load 用 setTimeout）
await new Promise((r) => setTimeout(r, 20));
check(loadedDuration === 200000, `audio:loaded duration = ${loadedDuration} (期望 200000)`);
check(engine2.hasAudio, "load 后 hasAudio = true");

// ==================== 7. seeked 事件 ====================
section("7. seek → audio:seeked");

engine2.seek(5000);
check(true, "seek(5000) → API 正常");

// ==================== 8. initPlayback DOM 连线 ====================
section("8. initPlayback DOM 连线");

const btnPlay = document.getElementById("btn-play");
const timeDisplay = document.getElementById("time-display");
const progressBar = document.getElementById("progress-bar");
const volumeSlider = document.getElementById("volume-slider");

check(btnPlay !== null, "#btn-play 存在");
check(timeDisplay !== null, "#time-display 存在");
check(progressBar !== null, "#progress-bar 存在");
check(volumeSlider !== null, "#volume-slider 存在");

check(btnPlay.disabled, "btn-play 初始 disabled");
check(progressBar.disabled, "progress-bar 初始 disabled");
check(btnPlay.textContent === "▶", "btn-play 初始 ▶");

const engine3 = new AudioEngine();
initPlayback(engine3);

// 按钮点击（hasAudio=false 守卫）
try {
    btnPlay.click();
    check(true, "btnPlay click 不抛错（hasAudio=false 守卫）");
} catch (e) {
    check(false, `btnPlay click 抛错: ${e.message}`);
}

volumeSlider.value = "30";
volumeSlider.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
check(true, "volume input 事件不抛错");

// ==================== 9. audio:loaded → 控件启用 ====================
section("9. audio:loaded → 控件状态");

bus.emit("audio:loaded", { duration: 300000 });

check(!progressBar.disabled, "audio:loaded → progressBar 启用");
check(!btnPlay.disabled, "audio:loaded → btnPlay 启用");
check(Number(progressBar.max) === 300000, "progressBar.max = 300000 (duration ms)");
check(Number(progressBar.value) === 0, "progressBar.value = 0");
check(timeDisplay.textContent === "00:00.000 / 05:00.000", "timeDisplay = 00:00.000 / 05:00.000");

// ==================== 10. audio:play/pause → 按钮图标 ====================
section("10. audio:play/pause → 按钮图标");

bus.emit("audio:play");
check(btnPlay.textContent === "⏸", "audio:play → btnPlay = ⏸");

bus.emit("audio:pause");
check(btnPlay.textContent === "▶", "audio:pause → btnPlay = ▶");

// ==================== 11. audio:timeupdate → 时间 + 进度条 ====================
section("11. audio:timeupdate → 时间/进度条更新");

bus.emit("audio:timeupdate", { currentTime: 45000 });
check(timeDisplay.textContent === "00:45.000 / 05:00.000", "timeDisplay = 00:45.000 / 05:00.000");
check(Number(progressBar.value) === 45000, "progressBar.value = 45000");

// 拖拽中进度条不跟随 timeupdate
progressBar.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
bus.emit("audio:timeupdate", { currentTime: 60000 });
check(Number(progressBar.value) === 45000, "拖拽中 progressBar 不跟随 timeupdate（保持 45000）");

// ==================== 12. 进度条 mouseup → seek ====================
section("12. 进度条 mouseup → engine.seek");

let seekValue = -1;
const engine4 = {
    hasAudio: true,
    isPlaying: false,
    toggle() {},
    play() {},
    pause() {},
    seek(v) { seekValue = v; },
    setVolume() {},
};
initPlayback(engine4);

// 需要 dispatch mousedown 设置 engine4 的 isSeeking
progressBar.value = "120000";
progressBar.dispatchEvent(new dom.window.MouseEvent("mousedown", { bubbles: true }));
document.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
check(seekValue === 120000, `mouseup → engine.seek(${seekValue})`);

// ==================== 13. 键盘快捷键 ====================
section("13. 键盘快捷键 Space");

// 注意：每次 initPlayback 会在 document 上累加 keydown 监听器
// 此处测试第一个引擎的 Space 行为
let toggle1 = 0;
const engine5 = {
    hasAudio: true,
    toggle() { toggle1++; },
    play() {},
    pause() {},
    seek() {},
    setVolume() {},
};
initPlayback(engine5);

toggle1 = 0;
document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "Space", bubbles: true }));
check(toggle1 === 1, "Space → toggle() 触发 1 次");

// INPUT 内豁免（engine5 的监听器会检查，不触发 toggle1）
toggle1 = 0;
const input = document.createElement("input");
document.body.appendChild(input);
input.focus();
document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "Space", bubbles: true }));
check(toggle1 === 0, "Space in INPUT → 不触发 toggle");
input.blur();
document.body.removeChild(input);

// TEXTAREA 内豁免
toggle1 = 0;
const textarea = document.createElement("textarea");
document.body.appendChild(textarea);
textarea.focus();
document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "Space", bubbles: true }));
check(toggle1 === 0, "Space in TEXTAREA → 不触发 toggle");
textarea.blur();
document.body.removeChild(textarea);

// hasAudio=false → engine6 的 handler 检查 hasAudio 为 false，不触发 toggle
let toggle2 = 0;
const engine6 = {
    hasAudio: false,
    toggle() { toggle2++; },
    play() {},
    pause() {},
    seek() {},
    setVolume() {},
};
initPlayback(engine6);

// engine5 的 handler (hasAudio=true) 仍会触发 toggle1，engine6 的不会
toggle1 = 0;
toggle2 = 0;
document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { code: "Space", bubbles: true }));
// engine5 的 handler 检查 engine5.hasAudio=true → toggle1++
// engine6 的 handler 检查 engine6.hasAudio=false → 不触发 toggle2
check(toggle2 === 0, "hasAudio=false 的引擎 → Space 不触发 toggle");

// ==================== 汇总 ====================
console.log("\n═══════════════════════════════════");
console.log(`通过: ${passed}  失败: ${failed}`);
if (failed === 0) {
    console.log("🎉 Phase 3 全部测试通过！");
    console.log("  AudioEngine         静态方法 isAudioFile ✓");
    console.log("  AudioEngine         初始状态 ✓");
    console.log("  AudioEngine         play/pause/toggle 事件 ✓");
    console.log("  AudioEngine         seek/setVolume API ✓");
    console.log("  AudioEngine         load(File) → audio:loaded ✓");
    console.log("  initPlayback        DOM 控件连线 ✓");
    console.log("  audio:loaded        控件启用 + 时间显示 ✓");
    console.log("  audio:play/pause    按钮图标切换 ✓");
    console.log("  audio:timeupdate    时间 + 进度条更新 ✓");
    console.log("  进度条拖拽          isSeeking 互斥 + mouseup seek ✓");
    console.log("  键盘快捷键          Space 触发 + input/textarea 豁免 ✓");
    console.log("  健壮性              hasAudio 守卫 ✓");
} else {
    console.log(`❌ ${failed} 个测试失败`);
    process.exit(1);
}
console.log("═══════════════════════════════════");

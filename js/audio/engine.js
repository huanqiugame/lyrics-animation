/**
 * 音频引擎
 * 封装 HTMLAudioElement，通过 requestAnimationFrame 驱动时间更新，
 * 通过全局事件总线广播播放状态
 */

import { bus } from "../utils/events.js";

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i;

export class AudioEngine {
    /** @type {HTMLAudioElement} */
    #audio;
    #raf_id = 0;
    #is_playing = false;

    constructor() {
        this.#audio = new Audio();
        this.#audio.volume = 0.8;
        this.#audio.preload = "auto";

        this.#audio.addEventListener("loadedmetadata", () => {
            bus.emit("audio:loaded", { duration: this.duration });
        });

        this.#audio.addEventListener("play", () => {
            this.#is_playing = true;
            this.#startLoop();
            bus.emit("audio:play");
        });

        this.#audio.addEventListener("pause", () => {
            this.#is_playing = false;
            this.#cancelLoop();
            bus.emit("audio:pause");
        });

        this.#audio.addEventListener("ended", () => {
            this.#is_playing = false;
            this.#cancelLoop();
            bus.emit("audio:pause");
        });

        this.#audio.addEventListener("seeked", () => {
            bus.emit("audio:seeked", { currentTime: this.currentTime });
        });

        this.#audio.addEventListener("error", () => {
            const msg = this.#audio.error
                ? `音频错误 (${this.#audio.error.code}): ${this.#audio.error.message}`
                : "未知音频错误";
            bus.emit("audio:error", { message: msg });
        });
    }

    /** 从 File 对象加载音频 */
    load(file) {
        if (this.#audio.src) {
            URL.revokeObjectURL(this.#audio.src);
        }
        this.#audio.src = URL.createObjectURL(file);
        this.#audio.load();
    }

    play() {
        const result = this.#audio.play();
        if (result && typeof result.catch === "function") {
            result.catch((err) => {
                console.error("音频播放失败:", err);
            });
        }
    }

    pause() {
        this.#audio.pause();
    }

    toggle() {
        if (this.#is_playing) {
            this.pause();
        } else {
            this.play();
        }
    }

    /**
     * 跳转到指定位置
     * @param {number} time_ms - 毫秒
     */
    seek(time_ms) {
        this.#audio.currentTime = time_ms / 1000;
    }

    /**
     * 设置音量
     * @param {number} percent - 0-100
     */
    setVolume(percent) {
        this.#audio.volume = Math.max(0, Math.min(1, percent / 100));
    }

    /** 当前播放位置（毫秒） */
    get currentTime() {
        return this.#audio.currentTime * 1000;
    }

    /** 音频总时长（毫秒） */
    get duration() {
        const d = this.#audio.duration;
        return Number.isFinite(d) ? d * 1000 : 0;
    }

    get isPlaying() {
        return this.#is_playing;
    }

    get hasAudio() {
        return this.#audio.duration > 0 && !Number.isNaN(this.#audio.duration);
    }

    /** 检查文件是否为支持的音频格式 */
    static isAudioFile(file) {
        return AUDIO_EXTENSIONS.test(file.name);
    }

    #startLoop() {
        this.#cancelLoop();
        const tick = () => {
            if (!this.#is_playing) return;
            bus.emit("audio:timeupdate", { currentTime: this.currentTime });
            this.#raf_id = requestAnimationFrame(tick);
        };
        this.#raf_id = requestAnimationFrame(tick);
    }

    #cancelLoop() {
        if (this.#raf_id) {
            cancelAnimationFrame(this.#raf_id);
            this.#raf_id = 0;
        }
    }
}

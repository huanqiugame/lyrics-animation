/**
 * 内部数据模型定义
 * 所有时间单位为毫秒（整数）
 */

// ---- 默认值 ----

export const DEFAULTS = {
	blurStartAmount: 8,       // px
	blurEndAmount: 0,        // px
	blurDuration: "word",    // 'word' | 'line'
	scrollDistance: 20,      // vh
	scrollDirection: "up",   // 'up' | 'down'
	scrollEasing: "ease-out",
	fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
	fontSize: 48,            // px
	textColor: "#ffffff",
	textShadow: "0 0 10px rgba(0,0,0,0.5)",
	textStroke: "none",
};

// ---- 工厂函数 ----

/**
 * @returns {import('./types.js').LyricWord}
 */
export function createLyricWord(word = "", startTime = 0, endTime = 0) {
	return {
		word,
		startTime,
		endTime,
		style: null,
	};
}

/**
 * @returns {import('./types.js').LyricLine}
 */
export function createLyricLine() {
	return {
		id: "",
		words: [],
		translatedLyric: "",
		romanLyric: "",
		startTime: 0,
		endTime: 0,
		isDuet: false,
		style: null,
	};
}

/**
 * @returns {import('./types.js').AnimationConfig}
 */
export function createDefaultConfig() {
	return {
		blur: {
			enabled: true,
			startAmount: DEFAULTS.blurStartAmount,
			endAmount: DEFAULTS.blurEndAmount,
			duration: DEFAULTS.blurDuration,
		},
		scroll: {
			enabled: true,
			direction: DEFAULTS.scrollDirection,
			distance: DEFAULTS.scrollDistance,
			easing: DEFAULTS.scrollEasing,
		},
		text: {
			fontFamily: DEFAULTS.fontFamily,
			fontSize: DEFAULTS.fontSize,
			color: DEFAULTS.textColor,
			textShadow: DEFAULTS.textShadow,
			stroke: DEFAULTS.textStroke,
		},
	};
}

/**
 * @returns {import('./types.js').ProjectData}
 */
export function createEmptyProject() {
	return {
		version: 1,
		lyrics: [],
		animConfig: createDefaultConfig(),
		audioFileName: null,
	};
}

// JSDoc 类型定义（用于 IDE 提示）
// 实际运行时不需要这些，仅作文档和开发参考

/**
 * @typedef {object} WordStyle
 * @property {number} [scale]  - 缩放倍数
 * @property {string} [color]  - CSS 颜色
 * @property {boolean} [bold]  - 加粗
 */

/**
 * @typedef {object} LyricWord
 * @property {string} word
 * @property {number} startTime
 * @property {number} endTime
 * @property {WordStyle|null} style
 */

/**
 * @typedef {object} LineStyle
 * @property {number} [scale]
 * @property {string} [color]
 */

/**
 * @typedef {object} LyricLine
 * @property {string} id
 * @property {LyricWord[]} words
 * @property {string} translatedLyric
 * @property {string} romanLyric
 * @property {number} startTime
 * @property {number} endTime
 * @property {boolean} isDuet
 * @property {LineStyle|null} style
 */

/**
 * @typedef {object} AnimationConfig
 * @property {{enabled: boolean, startAmount: number, endAmount: number, duration: string}} blur
 * @property {{enabled: boolean, direction: string, distance: number, easing: string}} scroll
 * @property {{fontFamily: string, fontSize: number, color: string, textShadow: string, stroke: string}} text
 */

/**
 * @typedef {object} ProjectData
 * @property {number} version
 * @property {LyricLine[]} lyrics
 * @property {AnimationConfig} animConfig
 * @property {string|null} audioFileName
 */

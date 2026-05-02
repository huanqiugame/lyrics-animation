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
		styleRef: null,
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
		isBackground: false,
		agentId: "",
		style: null,
		styleRef: null,
		regionId: null,
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
		title: null,
		lang: "en-US",
		lyrics: [],
		agents: [],
		styles: {},
		regions: {},
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
 * @property {string|null} styleRef - 引用的 TTML style id
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
 * @property {boolean} isBackground
 * @property {string} agentId
 * @property {LineStyle|null} style
 * @property {string|null} styleRef
 * @property {string|null} regionId
 */

/**
 * @typedef {object} AgentInfo
 * @property {string} id
 * @property {string} type - 'person' | 'group' | 'other'
 * @property {string} name
 */

/**
 * @typedef {object} TtmlStyle
 * @property {string} id
 * @property {Record<string, string>} properties - tts 属性（键不含 tts: 前缀）
 */

/**
 * @typedef {object} RegionInfo
 * @property {string} id
 * @property {string} origin
 * @property {string} extent
 * @property {string} textAlign
 * @property {string} displayAlign
 * @property {string|null} styleRef
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
 * @property {string|null} title
 * @property {string} lang
 * @property {LyricLine[]} lyrics
 * @property {AgentInfo[]} agents
 * @property {Record<string, TtmlStyle>} styles
 * @property {Record<string, RegionInfo>} regions
 * @property {AnimationConfig} animConfig
 * @property {string|null} audioFileName
 */

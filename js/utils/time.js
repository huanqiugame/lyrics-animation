/**
 * TTML 时间戳与毫秒的互转工具
 * TTML 格式：HH:MM:SS.mmm 或 MM:SS.mmm（毫秒部分 1-3 位）
 */

const TIME_REGEX =
	/^(((?<hour>[0-9]+):)?(?<min>[0-9]+):)?(?<sec>[0-9]+)[.:](?<frac>[0-9]{1,3})$/;

/**
 * 将 TTML 时间戳字符串解析为毫秒数
 * @param {string} timeSpan - 如 "00:06.687" 或 "01:30:05.500"
 * @returns {number} 毫秒数（整数）
 * @throws {TypeError} 格式不匹配时抛出
 */
export function parseTimespan(timeSpan) {
	const matches = TIME_REGEX.exec(timeSpan);
	if (!matches) {
		throw new TypeError(`时间戳字符串解析失败：${timeSpan}`);
	}
	const hour = Number(matches.groups?.hour || "0");
	const min = Number(matches.groups?.min || "0");
	const sec = Number(matches.groups?.sec || "0");
	const frac = Number((matches.groups?.frac || "0").padEnd(3, "0"));
	return (hour * 3600 + min * 60 + sec) * 1000 + frac;
}

/**
 * 将毫秒数格式化为 TTML 时间戳字符串
 * @param {number} timeMS - 毫秒数
 * @param {object} [options]
 * @param {boolean} [options.ms=true] - 是否包含毫秒部分
 * @returns {string} 如 "00:06.687"
 */
export function msToTimestamp(timeMS, { ms = true } = {}) {
	let t = timeMS;

	if (t === Number.POSITIVE_INFINITY || t == null || Number.isNaN(t)) {
		return "99:59.999";
	}
	if (t < 0) {
		t = 0;
	}

	t = Math.round(t) / 1000;
	const secs = t % 60;
	t = (t - secs) / 60;
	const mins = t % 60;
	const hrs = (t - mins) / 60;

	const h = String(hrs).padStart(2, "0");
	const m = String(mins).padStart(2, "0");

	if (!ms) {
		const s = String(Math.floor(secs)).padStart(2, "0");
		return hrs > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
	}

	const s = secs.toFixed(3).padStart(6, "0");
	return hrs > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

/**
 * 缓动曲线注册表
 * 提供预设曲线和自定义贝塞尔曲线计算
 */

/**
 * 创建贝塞尔曲线函数
 * 通过牛顿法求解给定 x 坐标对应的 y 值
 *
 * @param {number} x1 - 控制点1 X
 * @param {number} y1 - 控制点1 Y
 * @param {number} x2 - 控制点2 X
 * @param {number} y2 - 控制点2 Y
 * @returns {(t: number) => number} 接受 t∈[0,1]，返回 y∈[0,1]
 */
export function cubicBezier(x1, y1, x2, y2) {
    // 使用 Newton-Raphson 迭代求解
    const NEWTON_ITERATIONS = 4;
    const NEWTON_MIN_SLOPE = 0.001;
    const SUBDIVISION_PRECISION = 0.0000001;
    const SUBDIVISION_MAX_ITERATIONS = 10;

    function sampleCurveX(t) {
        return ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t + 3 * x1 * t;
    }

    function sampleCurveY(t) {
        return ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t + 3 * y1 * t;
    }

    function sampleCurveDerivativeX(t) {
        return (3 * (1 - 3 * x2 + 3 * x1) * t + 2 * (3 * x2 - 6 * x1)) * t + 3 * x1;
    }

    function solveCurveX(x) {
        let t = x;
        for (let i = 0; i < NEWTON_ITERATIONS; i++) {
            const currentX = sampleCurveX(t) - x;
            if (Math.abs(currentX) < SUBDIVISION_PRECISION) return t;
            const currentSlope = sampleCurveDerivativeX(t);
            if (Math.abs(currentSlope) < NEWTON_MIN_SLOPE) break;
            t -= currentX / currentSlope;
        }

        // 二分法兜底
        let lo = 0;
        let hi = 1;
        t = x;
        while (lo < hi) {
            const currentX = sampleCurveX(t);
            if (Math.abs(currentX - x) < SUBDIVISION_PRECISION) return t;
            if (x > currentX) lo = t;
            else hi = t;
            t = (lo + hi) / 2;
        }
        return t;
    }

    return (t) => {
        if (t === 0 || t === 1) return t;
        return sampleCurveY(solveCurveX(t));
    };
}

/**
 * 预设缓动曲线
 * @type {Map<string, {id: string, label: string, fn: (t: number) => number}>}
 */
export const EASING_PRESETS = new Map([
    ["linear", {
        id: "linear",
        label: "Linear",
        fn: (t) => t,
    }],
    ["ease-in", {
        id: "ease-in",
        label: "Ease In",
        fn: cubicBezier(0.42, 0, 1, 1),
    }],
    ["ease-out", {
        id: "ease-out",
        label: "Ease Out",
        fn: cubicBezier(0, 0, 0.58, 1),
    }],
    ["ease-in-out", {
        id: "ease-in-out",
        label: "Ease In Out",
        fn: cubicBezier(0.42, 0, 0.58, 1),
    }],
    ["ease-in-quad", {
        id: "ease-in-quad",
        label: "Ease In Quad",
        fn: (t) => t * t,
    }],
    ["ease-out-quad", {
        id: "ease-out-quad",
        label: "Ease Out Quad",
        fn: (t) => t * (2 - t),
    }],
    ["ease-in-cubic", {
        id: "ease-in-cubic",
        label: "Ease In Cubic",
        fn: (t) => t * t * t,
    }],
    ["ease-out-cubic", {
        id: "ease-out-cubic",
        label: "Ease Out Cubic",
        fn: (t) => (--t) * t * t + 1,
    }],
    ["ease-in-back", {
        id: "ease-in-back",
        label: "Ease In Back",
        fn: cubicBezier(0.6, -0.28, 0.735, 0.045),
    }],
    ["ease-out-back", {
        id: "ease-out-back",
        label: "Ease Out Back",
        fn: cubicBezier(0.175, 0.885, 0.32, 1.275),
    }],
    ["bounce-out", {
        id: "bounce-out",
        label: "Bounce Out",
        fn: (t) => {
            if (t < 1 / 2.75) {
                return 7.5625 * t * t;
            } else if (t < 2 / 2.75) {
                t -= 1.5 / 2.75;
                return 7.5625 * t * t + 0.75;
            } else if (t < 2.5 / 2.75) {
                t -= 2.25 / 2.75;
                return 7.5625 * t * t + 0.9375;
            } else {
                t -= 2.625 / 2.75;
                return 7.5625 * t * t + 0.984375;
            }
        },
    }],
    ["elastic-out", {
        id: "elastic-out",
        label: "Elastic Out",
        fn: (t) => {
            const p = 0.3;
            return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
        },
    }],
]);

/**
 * 获取缓动函数
 * @param {string} id - 曲线 ID
 * @returns {(t: number) => number}
 */
export function getEasing(id) {
    const preset = EASING_PRESETS.get(id);
    return preset ? preset.fn : EASING_PRESETS.get("linear").fn;
}

/**
 * 计算缓动值
 * @param {string} easing_id - 曲线 ID
 * @param {number} t - 进度值 [0, 1]
 * @returns {number} 缓动后的值
 */
export function evaluateEasing(easing_id, t) {
    return getEasing(easing_id)(t);
}

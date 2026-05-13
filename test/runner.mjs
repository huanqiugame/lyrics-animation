/**
 * 测试运行器：逐个运行每个测试文件，汇总总通过/失败数
 *
 * 用法：/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node test/runner.mjs
 */

import { spawn } from "child_process";

const NODE = "/Users/huanqiu/.nvm/versions/node/v24.15.0/bin/node";
const __dirname = decodeURIComponent(new URL(".", import.meta.url).pathname);

const tests = [
    "roundtrip-v2.mjs",
    "phase3-audio.mjs",
    "phase4-animation.mjs",
    "step3-line-selection.mjs",
    "step-anim-editor.mjs",
    "step-word-selection.mjs",
    "step-anchor-align.mjs",
    "step-fallback-chain.mjs",
    "step-priority-chain.mjs",
    "step-drag-reorder.mjs",
];

let total_assert_passed = 0;
let total_assert_failed = 0;
let test_passed = 0;
let test_failed = 0;

for (const file of tests) {
    const file_path = __dirname + file;

    console.log(`\n${"=".repeat(52)}`);
    console.log(`  运行: ${file}`);
    console.log(`${"=".repeat(52)}\n`);

    const { code, stdout } = await new Promise((resolve) => {
        const child = spawn(NODE, [file_path], {
            stdio: ["inherit", "pipe", "pipe"],
        });

        let stdout = "";
        child.stdout.on("data", (data) => {
            process.stdout.write(data);
            stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
            process.stderr.write(data);
        });

        child.on("close", (code) => {
            resolve({ code, stdout });
        });
    });

    // 解析断言汇总行："通过: X  失败: Y"
    const m = stdout.match(/通过:\s*(\d+)\s*失败:\s*(\d+)/);
    if (m) {
        total_assert_passed += parseInt(m[1], 10);
        total_assert_failed += parseInt(m[2], 10);
    }

    if (code === 0) {
        test_passed++;
    } else {
        test_failed++;
    }
}

// ==================== 汇总 ====================
const total_assert = total_assert_passed + total_assert_failed;
console.log(`\n${"=".repeat(52)}`);
console.log("  测 试 汇 总");
console.log(`${"=".repeat(52)}`);
console.log(`  测试文件: ${test_passed} 通过, ${test_failed} 失败 (共 ${tests.length} 个)`);
console.log(`  断  言:   ${total_assert_passed} 通过, ${total_assert_failed} 失败 (共 ${total_assert} 个)`);

if (test_failed === 0 && total_assert_failed === 0) {
    console.log("\n🎉 全部测试通过！");
} else {
    console.log(`\n❌ ${test_failed} 个测试文件失败, ${total_assert_failed} 个断言失败`);
    process.exit(1);
}

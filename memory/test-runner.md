---
name: test-runner
description: 测试运行器 test/runner.mjs — 逐个运行测试文件并汇总断言级通过的设置、工作原理及维护须知
metadata:
  type: reference
---

`test/runner.mjs` 取代了 `package.json` 中 hand-written 的 `&&` 链式调用。它会逐个运行 `test/` 目录下的每个 `.mjs` 测试文件，汇总结论：

- **测试文件级**: 统计每个测试文件的退出码（0 = 通过，非0 = 失败）
- **断言级**: 解析每个测试文件输出的 `通过: X  失败: Y` 行，累加得到全局断言总数

**包含的测试文件（共 9 个）**:
- `roundtrip-v2.mjs` — TTML 解析/序列化 roundtrip
- `phase3-audio.mjs` — 音频引擎
- `phase4-animation.mjs` — 动画渲染引擎
- `step3-line-selection.mjs` — 行选择
- `step-anim-editor.mjs` — 动画组编辑器
- `step-word-selection.mjs` — 字选择
- `step-anchor-align.mjs` — 锚点/对齐
- `step-fallback-chain.mjs` — 回退链
- `step-priority-chain.mjs` — 优先级链

**维护须知**:
- 添加新测试文件时，同时更新 `test/runner.mjs` 中的 `tests` 数组
- 测试文件必须用 `process.exit(1)` 表示失败
- 测试文件必须输出 `通过: X  失败: Y` 格式的汇总行，否则断言级汇总不会计入
- 如果重命名 node 路径，更新 runner 中的 `NODE` 常量

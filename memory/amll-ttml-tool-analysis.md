---
name: amll-ttml-tool-analysis
description: "Analysis of amll-ttml-tool codebase - React+Vite+Jotai, GPLv3 license, TTML parser/writer are the only reusable pure-logic modules, rest deeply coupled to React. Decision: build from scratch."
type: project
---

# amll-ttml-tool Codebase Analysis

**Date:** 2026-05-01

## Overview

amll-ttml-tool (local clone at `../amll-ttml-tool/`) is a React 19 + TypeScript + Vite 7 application for editing TTML-based lyric animations. It uses Jotai for state management, Radix UI for accessible components, and Framer Motion for animations.

**License:** GPLv3

## Modules That Are Framework-Independent (Reusable)

These are the only modules decoupled from React/Jotai/Radix:

1. **`ttml-parser.ts`** (596 lines) -- Pure TTML XML parsing using the DOM API. Takes raw XML string input, produces an internal data structure. No framework dependencies.

2. **`ttml-writer.ts`** (462 lines) -- Pure serialization from the internal data structure back to TTML XML. No framework dependencies.

3. **`timestamp.ts`** (64 lines) -- Timestamp parsing and formatting utilities. No framework dependencies.

## Everything Else is Tightly Coupled to React

All UI components, state management (Jotai atoms), the spectrogram renderer, audio playback controls, and the editing interface are deeply integrated with React, Jotai, and Radix UI. Extracting any of these would require significant refactoring and effectively rebuilding them.

## Decision

**Build the lyrics animation editor from scratch using native HTML/CSS/JS (no framework).**

Rationale:
- The GPLv3 license is restrictive for reuse.
- Only the TTML parser/writer and timestamp utilities are framework-independent -- everything else is locked into the React ecosystem.
- A native approach avoids framework overhead, gives full control over rendering, and aligns with the goal of a lightweight animation-focused editor.
- The parser and writer logic can be used as a reference specification for the new implementation without copying any code.

## Plan

**First module to build:** TTML parser + internal data model.

This will be a pure vanilla-JS module that:
- Parses TTML (XML) lyrics with timing metadata
- Produces a clean internal data model suitable for animation rendering
- Has no external dependencies
- Can be tested independently before building the editor UI

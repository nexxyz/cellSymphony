# Code Quality Baseline

## Standards (Staged Warning Mode)
- File LOC warn/hard: 500/800
- Function LOC warn/hard: 60/90
- Cyclomatic complexity warn/hard: 10/15
- Function params warn/hard: 4/6

## Summary
- Files scanned: 52
- Functions scanned (named function declarations): 28
- Large files (> 500 LOC): 3
- Complex functions (> 10): 1
- Long functions (> 60 LOC): 1
- Wide signatures (> 4 params): 3

## Top Large Files
- packages/platform-core/src/index.ts: 2663 LOC
- packages/platform-core/tests/features.test.ts: 741 LOC
- packages/platform-core/tests/logic.test.ts: 622 LOC

## Top Complex Functions
- apps/desktop/src/ui/App.tsx:26 App() complexity=29, loc=243

## Top Long Functions
- apps/desktop/src/ui/App.tsx:26 App() loc=243, complexity=29

## Naming Consistency (behavior vs behaviour)
- No `behaviour` identifier tokens found.


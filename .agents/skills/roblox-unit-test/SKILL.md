---
name: roblox-unit-test
description: >-
  Author and run automated Luau unit test suites inside Roblox Studio using TestEZ or lightweight assertions.
  Use this skill whenever asked to test game mechanics, verify ModuleScript logic, or validate data stores.
---

# 🧪 Roblox Automated Unit Testing Runbook

This skill teaches you how to structure, generate, and run unit tests for Roblox game modules and systems.

---

## 🎯 Workflow Steps

### 1. Identify Target Module
Locate the ModuleScript to be tested (e.g. `src/ReplicatedStorage/Modules/DamageCalculator.luau`).

### 2. Standard Test Suite Structure
Create a test runner script in `src/ServerScriptService/Tests/<ModuleName>.spec.luau` or execute it directly using `roblox_run_luau`.

```luau
-- Lightweight Test Runner Pattern
local tests = {}
local passed = 0
local failed = 0

local function assertEqual(actual, expected, message)
    if actual ~= expected then
        error(string.format("FAILED: %s | Expected: %s, Got: %s", message or "", tostring(expected), tostring(actual)))
    end
end

-- Test cases
function tests.testBaseDamage()
    local DamageCalc = require(game.ReplicatedStorage.Modules.DamageCalculator)
    local result = DamageCalc.calculate(100, 0.2)
    assertEqual(result, 80, "20% armor should reduce 100 dmg to 80")
end

-- Execution loop
for testName, fn in pairs(tests) do
    local ok, err = pcall(fn)
    if ok then
        passed = passed + 1
        print("  ✅ PASS: " .. testName)
    else
        failed = failed + 1
        warn("  ❌ FAIL: " .. testName .. " -> " .. tostring(err))
    end
end

print(string.format("Testing Complete: %d passed, %d failed", passed, failed))
return { passed = passed, failed = failed }
```

### 3. Run the Test in Studio
Submit the test runner code via `roblox_run_luau`:
- Inspect stdout for `✅ PASS` and `❌ FAIL` results.
- If failures occur, locate the logic error in the source module, fix it, and re-run.

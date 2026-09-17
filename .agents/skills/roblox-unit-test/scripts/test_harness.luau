--!strict
-- scripts/test_harness.luau
-- Standalone, zero-dependency Luau unit test runner harness.
-- Can be executed directly via roblox_run_luau in Studio.

local TestHarness = {}

type TestFn = () -> ()

local tests: { [string]: TestFn } = {}

function TestHarness.case(name: string, fn: TestFn)
    tests[name] = fn
end

function TestHarness.assertEqual<T>(actual: T, expected: T, message: string?)
    if actual ~= expected then
        error(string.format("Assertion Failed: %s\n   Expected: %s\n   Actual:   %s", 
            message or "Values not equal", tostring(expected), tostring(actual)), 2)
    end
end

function TestHarness.assertTrue(condition: boolean, message: string?)
    if not condition then
        error(string.format("Assertion Failed: %s (Expected true, got %s)", 
            message or "Condition failed", tostring(condition)), 2)
    end
end

function TestHarness.run()
    print("==================================================")
    print("🧪 RUNNING LUAU UNIT TESTS")
    print("==================================================")
    local passed = 0
    local failed = 0
    local startTime = os.clock()

    for name, fn in pairs(tests) do
        local ok, err = pcall(fn)
        if ok then
            passed += 1
            print("  ✅ PASS: " .. name)
        else
            failed += 1
            warn("  ❌ FAIL: " .. name)
            warn("     " .. tostring(err))
        end
    end

    local totalTimeMs = (os.clock() - startTime) * 1000
    print("--------------------------------------------------")
    print(string.format("Test Suite Completed in %.2f ms", totalTimeMs))
    print(string.format("Results: %d Passed, %d Failed", passed, failed))
    print("==================================================")

    return { passed = passed, failed = failed, totalTimeMs = totalTimeMs }
end

-- Example test definitions
TestHarness.case("Math: Basic Addition", function()
    TestHarness.assertEqual(2 + 2, 4, "2 + 2 should equal 4")
end)

TestHarness.case("Types: Boolean check", function()
    TestHarness.assertTrue(type("hello") == "string", "string type check")
end)

TestHarness.run()

return TestHarness

--!strict
-- scripts/microbenchmark.luau
-- Precision micro-benchmarking harness using os.clock().
-- Run via roblox_run_luau in Studio to measure execution times of Luau functions.

local function benchmark(name: string, iterations: number, targetFn: () -> ())
    -- Warmup phase (JIT optimization)
    for _ = 1, math.min(100, iterations) do
        targetFn()
    end

    local samples: { number } = {}
    local totalTime = 0

    for _ = 1, iterations do
        local start = os.clock()
        targetFn()
        local elapsed = os.clock() - start
        table.insert(samples, elapsed)
        totalTime += elapsed
    end

    local avgSec = totalTime / iterations
    local avgMicro = avgSec * 1000000

    print(string.format("⚡ BENCHMARK [%s] (%d iterations):", name, iterations))
    print(string.format("   Average: %.3f µs (microseconds) per run", avgMicro))
    print(string.format("   Total:   %.4f ms", totalTime * 1000))
end

-- Example Benchmark
print("Running Luau micro-benchmarks...")
local testTable = {}
for i = 1, 10000 do testTable[i] = i end

benchmark("Linear Table Search", 500, function()
    local found = nil
    for i, v in ipairs(testTable) do
        if v == 9999 then
            found = i
            break
        end
    end
end)

local lookupMap = {}
for i = 1, 10000 do lookupMap[i] = true end

benchmark("Dictionary Hash Lookup", 500, function()
    local found = lookupMap[9999]
end)

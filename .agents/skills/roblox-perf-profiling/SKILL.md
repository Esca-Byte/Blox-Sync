---
name: roblox-perf-profiling
description: >-
  Benchmark Luau execution speed, measure physics/render loop timings, detect memory leaks, and profile server performance in Roblox Studio.
  Use this skill whenever asked to optimize game performance, diagnose frame drops, or benchmark algorithms.
---

# ⚡ Roblox Performance Profiling & Benchmarking Runbook

This skill teaches you how to benchmark Luau code, evaluate memory usage, and identify performance bottlenecks in Roblox Studio.

---

## 🎯 Profiling Strategies

### 1. High-Precision Function Benchmarking
Use `os.clock()` (accurate to microseconds) to measure execution times over multiple iterations:

```luau
local function benchmark(label, iterations, fn)
    local start = os.clock()
    for i = 1, iterations do
        fn()
    end
    local elapsed = os.clock() - start
    local avgMs = (elapsed / iterations) * 1000
    print(string.format("[PERF] %s: Total = %.4fs, Avg = %.4fms (%d iterations)", label, elapsed, avgMs, iterations))
    return avgMs
end

-- Example usage via roblox_run_luau:
benchmark("Spatial Query", 1000, function()
    workspace:GetPartBoundsInBox(CFrame.new(0, 5, 0), Vector3.new(20, 20, 20))
end)
```

### 2. Memory Usage & Instance Auditing
Inspect current server/client memory categories using `Stats`:

```luau
local Stats = game:GetService("Stats")
local mem = Stats:GetTotalMemoryUsageMb()
local partCount = 0
for _, inst in ipairs(workspace:GetDescendants()) do
    if inst:IsA("BasePart") then partCount = partCount + 1 end
end

print(string.format("[MEMORY] Total Usage: %.2f MB | Workspace BaseParts: %d", mem, partCount))
```

### 3. Key Optimization Checklist
- **Replace `pairs()` with `ipairs()`** for contiguous arrays (faster in Luau).
- **Cache Service References**: Call `game:GetService("Players")` once at the top of the script, not inside loops.
- **De-bounce Network Calls**: Ensure RemoteEvents are rate-limited on the server to prevent network flooding.
- **Clean Connections**: Always disconnect `RBXScriptConnection` objects (`connection:Disconnect()`) when destroying UI or temporary models to prevent memory leaks.

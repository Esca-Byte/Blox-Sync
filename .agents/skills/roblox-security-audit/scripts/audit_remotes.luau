--!strict
-- scripts/audit_remotes.luau
-- Scans the DataModel for network remotes and reports potential security exposures.
-- Run directly via roblox_run_luau in Studio.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local remotesFound = 0
local warningsFound = 0

print("==================================================")
print("🛡️ ROBLOX NETWORK REMOTES AUDIT REPORT")
print("==================================================")

local suspiciousKeywords = {
    "set", "give", "add", "money", "coin", "gold", "damage", 
    "kill", "admin", "teleport", "speed", "jump", "buy", "grant"
}

local function auditInstance(inst: Instance)
    local isRemoteEvent = inst:IsA("RemoteEvent") or inst:IsA("UnreliableRemoteEvent")
    local isRemoteFunction = inst:IsA("RemoteFunction")

    if isRemoteEvent or isRemoteFunction then
        remotesFound += 1
        local path = inst:GetFullName()
        local nameLower = string.lower(inst.Name)
        local flags = {}

        if isRemoteFunction then
            table.insert(flags, "⚠️ RemoteFunction (Risk of server hang if InvokeClient is used)")
        end

        for _, keyword in ipairs(suspiciousKeywords) do
            if string.find(nameLower, keyword) then
                table.insert(flags, string.format("🚨 Name contains '%s' - verify server calculates value!", keyword))
                break
            end
        end

        if #flags > 0 then
            warningsFound += 1
            warn(string.format("[%s] %s", inst.ClassName, path))
            for _, flag in ipairs(flags) do
                warn("   -> " .. flag)
            end
        else
            print(string.format("   ✅ [%s] %s", inst.ClassName, path))
        end
    end
end

-- Scan ReplicatedStorage & Workspace
for _, inst in ipairs(ReplicatedStorage:GetDescendants()) do
    auditInstance(inst)
end

for _, inst in ipairs(Workspace:GetDescendants()) do
    if inst:IsA("RemoteEvent") or inst:IsA("RemoteFunction") then
        auditInstance(inst)
    end
end

print("--------------------------------------------------")
print(string.format("Audit Completed: %d Remotes inspected, %d flagged for review.", remotesFound, warningsFound))
if warningsFound == 0 then
    print("✨ No obvious high-risk remote naming patterns found.")
else
    warn(string.format("⚠️ %d remote(s) require manual server-side validation audit.", warningsFound))
end
print("==================================================")

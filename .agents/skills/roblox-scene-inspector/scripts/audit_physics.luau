--!strict
-- scripts/audit_physics.luau
-- Comprehensive 3D scene and physics audit script for Roblox Studio.
-- Run via roblox_run_luau in Studio to identify performance bottlenecks in Workspace.

local Workspace = game:GetService("Workspace")

local stats = {
    totalParts = 0,
    unanchored = 0,
    unanchoredUnconstrained = 0,
    defaultMeshFidelity = 0,
    totalLights = 0,
}

print("==================================================")
print("🌍 WORKSPACE PHYSICS & SCENE AUDIT")
print("==================================================")

for _, inst in ipairs(Workspace:GetDescendants()) do
    if inst:IsA("BasePart") then
        stats.totalParts += 1
        if not inst.Anchored then
            stats.unanchored += 1
            -- Check if connected by constraint or weld
            local constraints = inst:GetConnectedParts(true)
            if #constraints <= 1 then
                stats.unanchoredUnconstrained += 1
            end
        end

        if inst:IsA("MeshPart") then
            if inst.CollisionFidelity == Enum.CollisionFidelity.Default then
                stats.defaultMeshFidelity += 1
            end
        end
    elseif inst:IsA("PointLight") or inst:IsA("SpotLight") or inst:IsA("SurfaceLight") then
        stats.totalLights += 1
    end
end

print(string.format("Total BaseParts: %d", stats.totalParts))
print(string.format("Unanchored Parts: %d (Loose/Unconstrained: %d)", stats.unanchored, stats.unanchoredUnconstrained))
print(string.format("MeshParts with Default Collision Fidelity: %d", stats.defaultMeshFidelity))
print(string.format("Active Light Sources: %d", stats.totalLights))

print("--------------------------------------------------")
if stats.unanchoredUnconstrained > 50 then
    warn(string.format("⚠️ Found %d loose unanchored parts! Anchor them to prevent physics lag.", stats.unanchoredUnconstrained))
end
if stats.defaultMeshFidelity > 100 then
    warn("⚠️ Many MeshParts use Default collision fidelity. Consider switching non-essential decorative meshes to Box or Hull.")
end
if stats.totalLights > 100 then
    warn("⚠️ Over 100 light sources detected. May impact mobile rendering performance.")
end
if stats.unanchoredUnconstrained <= 50 and stats.totalLights <= 100 then
    print("✅ Scene physics and lighting health looks optimal!")
end
print("==================================================")

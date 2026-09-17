---
name: roblox-ui-builder
description: >-
  Build modern, responsive, animated ScreenGui interfaces (HUDs, shops, inventories, dialogues) using code-first Luau or Rojo metadata.
  Use this skill whenever asked to design, style, or implement 2D user interfaces in Roblox.
---

# 🎨 Roblox Code-First UI Design & Construction Runbook

This skill teaches you how to design modern, polished Roblox interfaces programmatically without falling into the common "empty folder" Rojo trap.

---

## ⚠️ Core Architecture Rule
Directories on disk map to generic `Folder` instances in Studio.
To render visual UI on screen, you MUST:
1. Create a `*.client.luau` script inside `src/StarterGui/` or `src/StarterPlayer/StarterPlayerScripts/` that constructs `ScreenGui` programmatically with `Instance.new("ScreenGui")`.
2. OR create an `init.meta.json` inside a directory specifying `"className": "ScreenGui"`.

---

## 💎 Design Standards for Premium Roblox UI

1. **Hierarchy Pattern**:
   - `ScreenGui` (ResetOnSpawn = false, ZIndexBehavior = Sibling)
     - `Frame` (Background canvas, AnchorPoint = (0.5, 0.5), Centered Position)
       - `UICorner` (Corner radius 8-12px)
       - `UIStroke` (Subtle 1px border with soft transparency)
       - `UIGradient` (Smooth dark gradient for modern glassmorphism)
       - Content elements (`TextLabel`, `TextButton`, `ScrollingFrame`)

2. **Responsive Scaling (Scale vs Offset)**:
   - Use `UDim2.new(scaleX, offsetX, scaleY, offsetY)` properly:
   - Primary frames: use scale for proportions (e.g. `UDim2.new(0.6, 0, 0.7, 0)`) or fixed responsive bounds with `UIAspectRatioConstraint`.
   - Buttons: fixed heights with auto-scale padding.

3. **Smooth Tween Animations**:
   Always animate UI opening and hover states with `TweenService`:

```luau
local TweenService = game:GetService("TweenService")
local tweenInfo = TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)

function animateOpen(frame)
    frame.Position = UDim2.new(0.5, 0, 0.55, 0)
    frame.Visible = true
    local tween = TweenService:Create(frame, tweenInfo, { Position = UDim2.new(0.5, 0, 0.5, 0) })
    tween:Play()
end
```

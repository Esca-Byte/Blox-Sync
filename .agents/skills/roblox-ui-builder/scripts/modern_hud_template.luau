--!strict
-- scripts/modern_hud_template.luau
-- Code-first responsive, glassmorphic UI builder module for Roblox Studio.
-- Can be required or executed live via roblox_run_luau.

local TweenService = game:GetService("TweenService")

local UIBuilder = {}

function UIBuilder.createGlassCard(parent: Instance, titleText: string, bodyText: string): Frame
    -- Main Card Container
    local card = Instance.new("Frame")
    card.Name = "GlassCard"
    card.Size = UDim2.new(0.3, 0, 0.22, 0)
    card.Position = UDim2.new(0.5, 0, 0.5, 0)
    card.AnchorPoint = Vector2.new(0.5, 0.5)
    card.BackgroundColor3 = Color3.fromRGB(24, 26, 32)
    card.BackgroundTransparency = 0.25
    card.BorderSizePixel = 0
    card.Parent = parent

    -- Rounded Corners
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 14)
    corner.Parent = card

    -- Neon Border Stroke
    local stroke = Instance.new("UIStroke")
    stroke.Color = Color3.fromRGB(90, 110, 240)
    stroke.Transparency = 0.4
    stroke.Thickness = 1.5
    stroke.Parent = card

    -- Title Label
    local title = Instance.new("TextLabel")
    title.Name = "Title"
    title.Size = UDim2.new(0.9, 0, 0.25, 0)
    title.Position = UDim2.new(0.05, 0, 0.1, 0)
    title.BackgroundTransparency = 1
    title.Text = titleText
    title.TextColor3 = Color3.fromRGB(255, 255, 255)
    title.TextScaled = true
    title.Font = Enum.Font.GothamBold
    title.TextXAlignment = Enum.TextXAlignment.Left
    title.Parent = card

    -- Body Label
    local body = Instance.new("TextLabel")
    body.Name = "Body"
    body.Size = UDim2.new(0.9, 0, 0.4, 0)
    body.Position = UDim2.new(0.05, 0, 0.4, 0)
    body.BackgroundTransparency = 1
    body.Text = bodyText
    body.TextColor3 = Color3.fromRGB(180, 185, 200)
    body.TextScaled = true
    body.Font = Enum.Font.Gotham
    body.TextXAlignment = Enum.TextXAlignment.Left
    body.Parent = card

    -- Smooth Hover Animation
    local tweenInfo = TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)
    local hoverIn = TweenService:Create(card, tweenInfo, { Size = UDim2.new(0.31, 0, 0.23, 0), BackgroundTransparency = 0.15 })
    local hoverOut = TweenService:Create(card, tweenInfo, { Size = UDim2.new(0.3, 0, 0.22, 0), BackgroundTransparency = 0.25 })

    card.MouseEnter:Connect(function()
        hoverIn:Play()
    end)
    card.MouseLeave:Connect(function()
        hoverOut:Play()
    end)

    return card
end

return UIBuilder

--[[
    ====================================================================
    🔗 Roblox Universal IDE Bridge — Studio Plugin (v2.0.0)
    ====================================================================
    Real-time two-way sync with any external IDE (VS Code, Cursor, 
    JetBrains, Neovim, Sublime, etc.) via Universal Bridge Server.
    ====================================================================
--]]

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local CoreGui = game:GetService("CoreGui")

local CONFIG = {
    serverUrl = "http://localhost:7777",
    pollInterval = 1.5,
    heartbeatInterval = 5,
    autoConnect = true
}

-- State
local isConnected = false
local activeProjectName = "None"
local lastSyncTimestamp = 0
local trackedFilesCount = 0
local isSyncing = false

-- Service Lookup Table
local SERVICE_MAP = {
    ReplicatedStorage = game:GetService("ReplicatedStorage"),
    ServerScriptService = game:GetService("ServerScriptService"),
    ServerStorage = game:GetService("ServerStorage"),
    StarterGui = game:GetService("StarterGui"),
    StarterPack = game:GetService("StarterPack"),
    Workspace = game:GetService("Workspace"),
    StarterPlayer = game:GetService("StarterPlayer"),
    StarterPlayerScripts = game:GetService("StarterPlayer"):WaitForChild("StarterPlayerScripts"),
    StarterCharacterScripts = game:GetService("StarterPlayer"):WaitForChild("StarterCharacterScripts")
}

-- Helper Functions
local function log(message, level)
    level = level or "INFO"
    local prefix = "[RobloxBridge] "
    if level == "ERROR" then
        warn(prefix .. "❌ " .. message)
    elseif level == "WARN" then
        warn(prefix .. "⚠️ " .. message)
    else
        print(prefix .. "ℹ️ " .. message)
    end
end

local function httpRequest(endpoint, method, bodyData)
    method = method or "GET"
    local url = CONFIG.serverUrl .. endpoint
    local headers = { ["Content-Type"] = "application/json" }
    
    local success, response = pcall(function()
        return HttpService:RequestAsync({
            Url = url,
            Method = method,
            Headers = headers,
            Body = bodyData and HttpService:JSONEncode(bodyData) or nil
        })
    end)

    if success and response.Success then
        local decodeSuccess, data = pcall(function()
            return HttpService:JSONDecode(response.Body)
        end)
        if decodeSuccess then
            return true, data
        end
    end

    return false, response and response.StatusMessage or "Connection failed"
end

-- Resolve or create parent instance hierarchy
local function resolveParent(robloxHierarchy)
    if not robloxHierarchy or robloxHierarchy == "" then
        return game:GetService("ReplicatedStorage")
    end

    local parts = string.split(robloxHierarchy, ".")
    local current = nil

    -- Check root service
    local rootName = parts[1]
    if SERVICE_MAP[rootName] then
        current = SERVICE_MAP[rootName]
    else
        local foundService = pcall(function() return game:GetService(rootName) end)
        if foundService then
            current = game:GetService(rootName)
        else
            current = game:GetService("ReplicatedStorage")
        end
    end

    -- Traversing remaining hierarchy parts
    for i = 2, #parts do
        local partName = parts[i]
        local child = current:FindFirstChild(partName)
        if not child then
            child = Instance.new("Folder")
            child.Name = partName
            child.Parent = current
        end
        current = child
    end

    return current
end

-- Create or update script instance in Roblox Studio
local function applyScriptChange(changeData)
    local scriptInfo = changeData.scriptInfo
    if not scriptInfo then return end

    local parent = resolveParent(scriptInfo.robloxHierarchy)
    local scriptName = scriptInfo.scriptName
    local scriptType = scriptInfo.scriptType or "ModuleScript"

    local existingScript = parent:FindFirstChild(scriptName)

    if changeData.action == "delete" then
        if existingScript then
            existingScript:Destroy()
            log("Deleted script: " .. scriptInfo.fullRobloxPath, "INFO")
        end
        return
    end

    -- Create or update
    if not existingScript or not existingScript:IsA(scriptType) then
        if existingScript then existingScript:Destroy() end
        existingScript = Instance.new(scriptType)
        existingScript.Name = scriptName
        existingScript.Parent = parent
    end

    if existingScript:IsA("LuaSourceContainer") then
        existingScript.Source = changeData.content or ""
        log("Updated " .. scriptType .. ": " .. scriptInfo.fullRobloxPath, "INFO")
    end
end

-- Plugin GUI & Toolbar Setup
local toolbar = plugin:CreateToolbar("Roblox Universal Bridge")
local statusButton = toolbar:CreateButton("Status Widget", "Toggle status dashboard UI", "rbxassetid://6031097225")

-- Create DockWidget
local widgetInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Right,
    false, false, 320, 420, 260, 300
)
local widget = plugin:CreateDockWidgetPluginGui("RobloxBridgeWidget", widgetInfo)
widget.Title = "Roblox Universal IDE Bridge v2.0"

-- Build UI Frame
local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(1, 0, 1, 0)
mainFrame.BackgroundColor3 = Color3.fromRGB(24, 25, 29)
mainFrame.Parent = widget

local uiLayout = Instance.new("UIListLayout")
uiLayout.SortOrder = Enum.SortOrder.LayoutOrder
uiLayout.Padding = UDim.new(0, 10)
uiLayout.Parent = mainFrame

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 12)
padding.PaddingBottom = UDim.new(0, 12)
padding.PaddingLeft = UDim.new(0, 12)
padding.PaddingRight = UDim.new(0, 12)
padding.Parent = mainFrame

-- Title Card
local titleCard = Instance.new("Frame")
titleCard.Size = UDim2.new(1, 0, 0, 45)
titleCard.BackgroundColor3 = Color3.fromRGB(33, 35, 42)
titleCard.Parent = mainFrame

local titleCorner = Instance.new("UICorner")
titleCorner.CornerRadius = UDim.new(0, 8)
titleCorner.Parent = titleCard

local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, -20, 1, 0)
titleLabel.Position = UDim2.new(0, 10, 0, 0)
titleLabel.BackgroundTransparency = 1
titleLabel.Text = "⚡ Universal IDE Bridge"
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextSize = 16
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.Parent = titleCard

-- Status Card
local statusCard = Instance.new("Frame")
statusCard.Size = UDim2.new(1, 0, 0, 90)
statusCard.BackgroundColor3 = Color3.fromRGB(33, 35, 42)
statusCard.Parent = mainFrame

local statusCorner = Instance.new("UICorner")
statusCorner.CornerRadius = UDim.new(0, 8)
statusCorner.Parent = statusCard

local statusText = Instance.new("TextLabel")
statusText.Size = UDim2.new(1, -20, 0, 25)
statusText.Position = UDim2.new(0, 10, 0, 8)
statusText.BackgroundTransparency = 1
statusText.Text = "Status: 🔴 Offline"
statusText.TextColor3 = Color3.fromRGB(240, 90, 90)
statusText.Font = Enum.Font.GothamMedium
statusText.TextSize = 14
statusText.TextXAlignment = Enum.TextXAlignment.Left
statusText.Parent = statusCard

local projectText = Instance.new("TextLabel")
projectText.Size = UDim2.new(1, -20, 0, 22)
projectText.Position = UDim2.new(0, 10, 0, 34)
projectText.BackgroundTransparency = 1
projectText.Text = "Project: Disconnected"
projectText.TextColor3 = Color3.fromRGB(180, 185, 200)
projectText.Font = Enum.Font.Gotham
projectText.TextSize = 12
projectText.TextXAlignment = Enum.TextXAlignment.Left
projectText.Parent = statusCard

local filesText = Instance.new("TextLabel")
filesText.Size = UDim2.new(1, -20, 0, 22)
filesText.Position = UDim2.new(0, 10, 0, 58)
filesText.BackgroundTransparency = 1
filesText.Text = "Tracked Files: 0"
filesText.TextColor3 = Color3.fromRGB(180, 185, 200)
filesText.Font = Enum.Font.Gotham
filesText.TextSize = 12
filesText.TextXAlignment = Enum.TextXAlignment.Left
filesText.Parent = statusCard

-- Connect Toggle Button inside UI
local uiConnectBtn = Instance.new("TextButton")
uiConnectBtn.Size = UDim2.new(1, 0, 0, 36)
uiConnectBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255)
uiConnectBtn.Text = "Connect to Bridge Server"
uiConnectBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiConnectBtn.Font = Enum.Font.GothamBold
uiConnectBtn.TextSize = 14
uiConnectBtn.Parent = mainFrame

local btnCorner = Instance.new("UICorner")
btnCorner.CornerRadius = UDim.new(0, 6)
btnCorner.Parent = uiConnectBtn

-- Pull & Export Row
local btnRow = Instance.new("Frame")
btnRow.Size = UDim2.new(1, 0, 0, 36)
btnRow.BackgroundTransparency = 1
btnRow.Parent = mainFrame

local rowLayout = Instance.new("UIListLayout")
rowLayout.FillDirection = Enum.FillDirection.Horizontal
rowLayout.Padding = UDim.new(0, 10)
rowLayout.Parent = btnRow

local uiPullBtn = Instance.new("TextButton")
uiPullBtn.Size = UDim2.new(0.5, -5, 1, 0)
uiPullBtn.BackgroundColor3 = Color3.fromRGB(45, 160, 90)
uiPullBtn.Text = "📥 Pull All Files"
uiPullBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiPullBtn.Font = Enum.Font.GothamBold
uiPullBtn.TextSize = 12
uiPullBtn.Parent = btnRow
local pullCorner = Instance.new("UICorner")
pullCorner.CornerRadius = UDim.new(0, 6)
pullCorner.Parent = uiPullBtn

local uiExportBtn = Instance.new("TextButton")
uiExportBtn.Size = UDim2.new(0.5, -5, 1, 0)
uiExportBtn.BackgroundColor3 = Color3.fromRGB(140, 70, 220)
uiExportBtn.Text = "📤 Export Game"
uiExportBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiExportBtn.Font = Enum.Font.GothamBold
uiExportBtn.TextSize = 12
uiExportBtn.Parent = btnRow
local exportCorner = Instance.new("UICorner")
exportCorner.CornerRadius = UDim.new(0, 6)
exportCorner.Parent = uiExportBtn

-- Update UI Dashboard
local function updateUI()
    if isConnected then
        statusText.Text = "Status: 🟢 Connected"
        statusText.TextColor3 = Color3.fromRGB(80, 220, 120)
        projectText.Text = "Project: " .. activeProjectName
        filesText.Text = "Tracked Files: " .. tostring(trackedFilesCount)
        uiConnectBtn.Text = "Disconnect"
        uiConnectBtn.BackgroundColor3 = Color3.fromRGB(220, 60, 60)
    else
        statusText.Text = "Status: 🔴 Offline"
        statusText.TextColor3 = Color3.fromRGB(240, 90, 90)
        projectText.Text = "Project: Disconnected"
        filesText.Text = "Tracked Files: 0"
        uiConnectBtn.Text = "Connect to Bridge Server"
        uiConnectBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255)
    end
end

-- Core Function: Pull All Files from Server
local function pullAllFiles()
    log("Pulling all files from server...", "INFO")
    local success, response = httpRequest("/files", "GET")
    if success and response.files then
        activeProjectName = response.projectName or "DefaultProject"
        trackedFilesCount = #response.files
        for _, fileData in ipairs(response.files) do
            applyScriptChange({
                action = "update",
                scriptInfo = fileData.scriptInfo,
                content = fileData.content
            })
        end
        ChangeHistoryService:SetWaypoint("Pulled files from IDE Bridge")
        log("Successfully pulled " .. #response.files .. " files!", "INFO")
        updateUI()
    else
        log("Failed to pull files: " .. tostring(response), "ERROR")
    end
end

-- Core Function: Export Studio Scripts to Server
local function exportGameScripts()
    log("Scanning Studio game scripts for export...", "INFO")
    local scriptsToExport = {}

    local function scanInstance(parent)
        for _, child in ipairs(parent:GetChildren()) do
            if child:IsA("LuaSourceContainer") and not child:FindFirstAncestorOfClass("CoreGui") then
                local robloxHierarchy = child.Parent:GetFullName()
                table.insert(scriptsToExport, {
                    fullRobloxPath = robloxHierarchy .. "." .. child.Name,
                    scriptName = child.Name,
                    scriptType = child.ClassName,
                    content = child.Source
                })
            end
            scanInstance(child)
        end
    end

    scanInstance(game:GetService("ReplicatedStorage"))
    scanInstance(game:GetService("ServerScriptService"))
    scanInstance(game:GetService("StarterPlayer"))

    log("Found " .. #scriptsToExport .. " scripts to export. Sending to server...", "INFO")
    local success, response = httpRequest("/sync-from-studio", "POST", { scripts = scriptsToExport })
    if success then
        log("Successfully exported " .. tostring(response.count) .. " scripts to IDE project!", "INFO")
    else
        log("Failed to export scripts: " .. tostring(response), "ERROR")
    end
end

-- Polling Loop
local function pollChanges()
    if not isConnected or isSyncing then return end
    isSyncing = true

    local success, response = httpRequest("/changes?since=" .. tostring(lastSyncTimestamp), "GET")
    if success then
        if response.timestamp then
            lastSyncTimestamp = response.timestamp
        end
        if response.projectName then
            activeProjectName = response.projectName
        end
        if response.changes and #response.changes > 0 then
            for _, change in ipairs(response.changes) do
                applyScriptChange(change)
            end
            ChangeHistoryService:SetWaypoint("Synced changes from IDE")
        end
        updateUI()
    else
        log("Server disconnected or unreachable.", "WARN")
        isConnected = false
        updateUI()
    end

    isSyncing = false
end

-- Connection Toggle
local function toggleConnection()
    if isConnected then
        isConnected = false
        log("Disconnected from bridge server.", "INFO")
        updateUI()
    else
        log("Connecting to bridge server at " .. CONFIG.serverUrl .. "...", "INFO")
        local success, response = httpRequest("/heartbeat", "POST", { timestamp = os.time() })
        if success then
            isConnected = true
            activeProjectName = response.activeProject or "DefaultProject"
            log("Connected to project: " .. activeProjectName, "INFO")
            pullAllFiles()
        else
            log("Could not connect to server at " .. CONFIG.serverUrl .. ". Make sure server is running!", "ERROR")
            isConnected = false
            updateUI()
        end
    end
end

-- Events & Listeners
uiConnectBtn.MouseButton1Click:Connect(toggleConnection)
uiPullBtn.MouseButton1Click:Connect(pullAllFiles)
uiExportBtn.MouseButton1Click:Connect(exportGameScripts)
statusButton.Click:Connect(function() widget.Enabled = not widget.Enabled end)

-- Background Loops
task.spawn(function()
    while true do
        task.wait(CONFIG.pollInterval)
        if isConnected then
            pollChanges()
        end
    end
end)

task.spawn(function()
    while true do
        task.wait(CONFIG.heartbeatInterval)
        if isConnected then
            httpRequest("/heartbeat", "POST", { timestamp = os.time() })
        end
    end
end)

-- Auto Connect on Studio start if configured
if CONFIG.autoConnect then
    task.delay(1, function()
        toggleConnection()
    end)
end

log("Roblox Universal IDE Bridge Plugin v2.0 loaded successfully!", "INFO")

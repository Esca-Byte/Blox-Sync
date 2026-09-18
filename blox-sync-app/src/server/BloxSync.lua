--[[
    ====================================================================
    ⚡ Blox Sync — Studio Plugin (v2.2.0)
    ====================================================================
    Real-time two-way sync with any external IDE (VS Code, Cursor, 
    JetBrains, Neovim, Sublime, Antigravity, etc.) via Blox Sync.

    PATH B ADDITIONS (v2.1+):
      • Luau Execution Engine  — run code from IDE directly in Studio
      • DataModel Tree Export  — live game hierarchy → Desktop App
      • LogService Streaming   — print/warn/error → Desktop App console
    ====================================================================
--]]

local HttpService        = game:GetService("HttpService")
local Selection          = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local CoreGui            = game:GetService("CoreGui")
local LogService         = game:GetService("LogService")
local RunService         = game:GetService("RunService")

local CONFIG = {
    serverUrl        = "http://localhost:7777",
    pollInterval     = 1.5,   -- seconds between change/execute polls
    heartbeatInterval = 5,    -- seconds between heartbeats
    treeInterval     = 10,    -- seconds between DataModel tree snapshots
    logFlushInterval = 2,     -- seconds between log batch flushes
    logMaxBatch      = 30,    -- max log entries per flush
    treeMaxDepth     = 3,     -- depth limit for DataModel serializer
    autoConnect      = true
}

-- ── State ───────────────────────────────────────────────────────────────────
local isConnected          = false
local activeProjectName    = "None"
local lastSyncTimestamp    = 0
local trackedFilesCount    = 0
local isSyncing            = false

-- Path B state
local pendingLogEntries    = {}  -- buffered LogService messages to flush
local lastTreeSent         = 0   -- os.time() of last /tree POST

-- ── Service Lookup Table ─────────────────────────────────────────────────────
local SERVICE_MAP = {
    ReplicatedStorage        = game:GetService("ReplicatedStorage"),
    ServerScriptService      = game:GetService("ServerScriptService"),
    ServerStorage            = game:GetService("ServerStorage"),
    StarterGui               = game:GetService("StarterGui"),
    StarterPack              = game:GetService("StarterPack"),
    Workspace                = game:GetService("Workspace"),
    StarterPlayer            = game:GetService("StarterPlayer"),
    StarterPlayerScripts     = game:GetService("StarterPlayer"):WaitForChild("StarterPlayerScripts"),
    StarterCharacterScripts  = game:GetService("StarterPlayer"):WaitForChild("StarterCharacterScripts")
}

-- ── Helpers ──────────────────────────────────────────────────────────────────
local function log(message, level)
    level = level or "INFO"
    local prefix = "[BloxSync] "
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
            Url     = url,
            Method  = method,
            Headers = headers,
            Body    = bodyData and HttpService:JSONEncode(bodyData) or nil
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

-- ── Script Instance Helpers ───────────────────────────────────────────────────
local function resolveParent(robloxHierarchy)
    if not robloxHierarchy or robloxHierarchy == "" then
        return game:GetService("ReplicatedStorage")
    end

    local parts = string.split(robloxHierarchy, ".")
    local current = nil

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

    for i = 2, #parts do
        local partName = parts[i]
        local child = current:FindFirstChild(partName)
        if not child then
            if current == game:GetService("StarterGui")
                or string.find(partName, "Gui")
                or string.find(partName, "Screen")
                or string.find(partName, "UI") then
                child = Instance.new("ScreenGui")
            else
                child = Instance.new("Folder")
            end
            child.Name = partName
            child.Parent = current
        end
        current = child
    end

    return current
end

local function findScriptByGuid(guid)
    if not guid or guid == "" then return nil end
    for _, service in pairs(SERVICE_MAP) do
        for _, descendant in ipairs(service:GetDescendants()) do
            if descendant:IsA("LuaSourceContainer") and (descendant:GetAttribute("BloxSyncGUID") == guid or descendant:GetAttribute("BridgeGUID") == guid) then
                return descendant
            end
        end
    end
    return nil
end

local function applyScriptChange(changeData)
    local scriptInfo = changeData.scriptInfo
    if not scriptInfo then return end

    local scriptName = scriptInfo.scriptName
    local scriptType = scriptInfo.scriptType or "ModuleScript"
    local guid = changeData.guid or (scriptInfo and scriptInfo.guid)

    local robloxHierarchy = scriptInfo.robloxHierarchy
    if not robloxHierarchy or robloxHierarchy == "" or robloxHierarchy == scriptInfo.fullRobloxPath then
        if scriptInfo.fullRobloxPath then
            local parts = string.split(scriptInfo.fullRobloxPath, ".")
            if #parts > 1 then
                table.remove(parts, #parts)
                robloxHierarchy = table.concat(parts, ".")
            else
                robloxHierarchy = parts[1]
            end
        end
    end

    local parent = resolveParent(robloxHierarchy)
    local existingScript = parent:FindFirstChild(scriptName)

    -- ── Handle Delete ────────────────────────────────────────────────────────
    if changeData.action == "delete" then
        if not existingScript and guid then
            existingScript = findScriptByGuid(guid)
        end
        if existingScript then
            existingScript:Destroy()
            log("Deleted script: " .. (scriptInfo.fullRobloxPath or scriptName), "INFO")
        end
        return
    end

    -- ── Feature 3: Handle Rename without Destroying Script ──────────────────
    if changeData.action == "rename" then
        local targetScript = nil

        -- 1. Locate by GUID attribute first (bulletproof even across paths)
        if guid then
            targetScript = findScriptByGuid(guid)
        end

        -- 2. Fallback: try old script location
        if not targetScript and changeData.oldScriptInfo then
            local oldHierarchy = changeData.oldScriptInfo.robloxHierarchy or ""
            local oldParent = resolveParent(oldHierarchy)
            targetScript = oldParent:FindFirstChild(changeData.oldScriptInfo.scriptName)
        end

        -- 3. Fallback: try filename in parent
        if not targetScript and changeData.oldRelPath then
            local oldFilename = string.match(changeData.oldRelPath, "([^/\\]+)%.%w+$")
            if oldFilename then
                oldFilename = string.gsub(oldFilename, "%.server$", "")
                oldFilename = string.gsub(oldFilename, "%.client$", "")
                targetScript = parent:FindFirstChild(oldFilename)
            end
        end

        if targetScript then
            targetScript.Name = scriptName
            targetScript.Parent = parent
            if changeData.content and targetScript:IsA("LuaSourceContainer") then
                targetScript.Source = changeData.content
            end
            if guid then
                targetScript:SetAttribute("BloxSyncGUID", guid)
                targetScript:SetAttribute("BridgeGUID", guid)
            end
            log("Renamed script: " .. (changeData.oldRelPath or "file") .. " -> " .. (scriptInfo.fullRobloxPath or scriptName) .. " (preserved GUID)", "INFO")
            return
        end
    end

    -- ── Create or Recreate if class mismatch ────────────────────────────────
    if not existingScript or not existingScript:IsA(scriptType) then
        if existingScript then existingScript:Destroy() end
        existingScript = Instance.new(scriptType)
        existingScript.Name = scriptName
        existingScript.Parent = parent
    end

    -- Tag with GUID attribute
    if guid then
        existingScript:SetAttribute("BloxSyncGUID", guid)
        existingScript:SetAttribute("BridgeGUID", guid)
    end

    if existingScript:IsA("LuaSourceContainer") then
        existingScript.Source = changeData.content or ""
        log("Updated " .. scriptType .. ": " .. (scriptInfo.fullRobloxPath or (robloxHierarchy .. "." .. scriptName)), "INFO")
    end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- PATH B: Luau Execution Engine
-- ═══════════════════════════════════════════════════════════════════════════

local function processExecuteQueue()
    if not isConnected then return end

    local success, response = httpRequest("/execute-queue", "GET")
    if not success or not response or not response.jobs then return end

    for _, job in ipairs(response.jobs) do
        local jobId        = job.id
        local code         = job.code
        local startTime    = os.clock()

        -- Safely compile and run the Luau code
        local fn, compileErr = loadstring(code)
        local outputMsg    = ""
        local didSucceed   = false
        local errMsg       = ""

        if not fn then
            errMsg      = "Compile error: " .. tostring(compileErr)
            didSucceed  = false
        else
            -- Capture print output by temporarily overriding print
            local capturedLines = {}
            local origPrint = print
            -- Override print for duration of execution
            local function capturePrint(...)
                local args = {...}
                local strs = {}
                for _, v in ipairs(args) do
                    table.insert(strs, tostring(v))
                end
                table.insert(capturedLines, table.concat(strs, "\t"))
                origPrint(...)  -- still print to Studio console
            end

            -- Use environment override to capture prints inside the code
            local env = setmetatable({ print = capturePrint }, { __index = getfenv(0) })
            setfenv(fn, env)

            local ok, runErr = pcall(fn)
            if ok then
                didSucceed  = true
                outputMsg   = table.concat(capturedLines, "\n")
                if outputMsg == "" then outputMsg = "(no output)" end
            else
                didSucceed  = false
                errMsg      = tostring(runErr)
                outputMsg   = table.concat(capturedLines, "\n")
            end
        end

        local elapsed = math.floor((os.clock() - startTime) * 1000)

        -- Report result back to server
        httpRequest("/execute-result", "POST", {
            jobId         = jobId,
            success       = didSucceed,
            output        = outputMsg,
            error         = errMsg,
            executionTime = elapsed
        })

        if didSucceed then
            log("Executed job #" .. tostring(jobId) .. " ✅ (" .. elapsed .. "ms)", "INFO")
        else
            log("Executed job #" .. tostring(jobId) .. " ❌: " .. errMsg, "ERROR")
        end
    end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- PATH B: DataModel Tree Serializer
-- ═══════════════════════════════════════════════════════════════════════════

local TOP_LEVEL_SERVICES = {
    "ReplicatedStorage", "ServerScriptService", "ServerStorage",
    "StarterGui", "StarterPack", "Workspace", "StarterPlayer",
    "Lighting", "SoundService", "Teams", "Players"
}

local function serializeInstance(inst, depth)
    if not inst or depth <= 0 then return nil end

    local node = {
        name      = inst.Name,
        className = inst.ClassName,
        children  = {}
    }

    -- Only recurse for non-leaf types to avoid massive payloads
    local ok, children = pcall(function() return inst:GetChildren() end)
    if ok and children then
        for _, child in ipairs(children) do
            if depth > 1 then
                local childNode = serializeInstance(child, depth - 1)
                if childNode then
                    table.insert(node.children, childNode)
                end
            else
                -- At max depth, just list the name/class without recursing
                table.insert(node.children, {
                    name      = child.Name,
                    className = child.ClassName,
                    children  = {}
                })
            end
        end
    end

    return node
end

local function buildAndSendTree()
    if not isConnected then return end

    local tree = {}
    for _, serviceName in ipairs(TOP_LEVEL_SERVICES) do
        local ok, service = pcall(function() return game:GetService(serviceName) end)
        if ok and service then
            local node = serializeInstance(service, CONFIG.treeMaxDepth)
            if node then
                table.insert(tree, node)
            end
        end
    end

    httpRequest("/tree", "POST", { tree = tree })
    lastTreeSent = os.time()
end

-- ═══════════════════════════════════════════════════════════════════════════
-- PATH B: LogService Console Streaming
-- ═══════════════════════════════════════════════════════════════════════════

-- Hook LogService.MessageOut to capture Studio print/warn/error
LogService.MessageOut:Connect(function(message, messageType)
    -- Skip our own sync log messages to avoid feedback loops
    if string.find(message, "%[BloxSync%]") or string.find(message, "%[RobloxBridge%]") then return end

    local level = "Print"
    if messageType == Enum.MessageType.MessageWarning then
        level = "Warning"
    elseif messageType == Enum.MessageType.MessageError then
        level = "Error"
    elseif messageType == Enum.MessageType.MessageInfo then
        level = "Info"
    end

    table.insert(pendingLogEntries, {
        message   = message,
        level     = level,
        timestamp = os.time() * 1000  -- ms epoch
    })

    -- Cap buffer size to avoid memory issues
    if #pendingLogEntries > 100 then
        table.remove(pendingLogEntries, 1)
    end
end)

local function flushStudioLogs()
    if not isConnected then return end
    if #pendingLogEntries == 0 then return end

    -- Drain up to logMaxBatch entries
    local batch = {}
    local limit = math.min(#pendingLogEntries, CONFIG.logMaxBatch)
    for i = 1, limit do
        table.insert(batch, pendingLogEntries[i])
    end
    for i = limit, 1, -1 do
        table.remove(pendingLogEntries, i)
    end

    if #batch > 0 then
        httpRequest("/log", "POST", { entries = batch })
    end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- Plugin GUI & Toolbar Setup
-- ═══════════════════════════════════════════════════════════════════════════

local toolbar     = plugin:CreateToolbar("Blox Sync")
local statusButton = toolbar:CreateButton("Status Widget", "Toggle status dashboard UI", "rbxassetid://6031097225")

local widgetInfo = DockWidgetPluginGuiInfo.new(
    Enum.InitialDockState.Right,
    false, false, 320, 520, 260, 380
)
local widget = plugin:CreateDockWidgetPluginGui("BloxSyncWidget", widgetInfo)
widget.Title = "Blox Sync v2.2"

-- Main frame
local mainFrame = Instance.new("Frame")
mainFrame.Size = UDim2.new(1, 0, 1, 0)
mainFrame.BackgroundColor3 = Color3.fromRGB(24, 25, 29)
mainFrame.Parent = widget

local uiLayout = Instance.new("UIListLayout")
uiLayout.SortOrder = Enum.SortOrder.LayoutOrder
uiLayout.Padding = UDim.new(0, 8)
uiLayout.Parent = mainFrame

local padding = Instance.new("UIPadding")
padding.PaddingTop    = UDim.new(0, 12)
padding.PaddingBottom = UDim.new(0, 12)
padding.PaddingLeft   = UDim.new(0, 12)
padding.PaddingRight  = UDim.new(0, 12)
padding.Parent = mainFrame

-- Title Card
local titleCard = Instance.new("Frame")
titleCard.Size = UDim2.new(1, 0, 0, 45)
titleCard.BackgroundColor3 = Color3.fromRGB(33, 35, 42)
titleCard.LayoutOrder = 1
titleCard.Parent = mainFrame
Instance.new("UICorner", titleCard).CornerRadius = UDim.new(0, 8)

local titleLabel = Instance.new("TextLabel")
titleLabel.Size = UDim2.new(1, -20, 1, 0)
titleLabel.Position = UDim2.new(0, 10, 0, 0)
titleLabel.BackgroundTransparency = 1
titleLabel.Text = "⚡ Blox Sync v2.2"
titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
titleLabel.Font = Enum.Font.GothamBold
titleLabel.TextSize = 15
titleLabel.TextXAlignment = Enum.TextXAlignment.Left
titleLabel.Parent = titleCard

-- Status Card
local statusCard = Instance.new("Frame")
statusCard.Size = UDim2.new(1, 0, 0, 90)
statusCard.BackgroundColor3 = Color3.fromRGB(33, 35, 42)
statusCard.LayoutOrder = 2
statusCard.Parent = mainFrame
Instance.new("UICorner", statusCard).CornerRadius = UDim.new(0, 8)

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

-- Connect Toggle Button
local uiConnectBtn = Instance.new("TextButton")
uiConnectBtn.Size = UDim2.new(1, 0, 0, 36)
uiConnectBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255)
uiConnectBtn.Text = "Connect to Blox Sync Server"
uiConnectBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiConnectBtn.Font = Enum.Font.GothamBold
uiConnectBtn.TextSize = 14
uiConnectBtn.LayoutOrder = 3
uiConnectBtn.Parent = mainFrame
Instance.new("UICorner", uiConnectBtn).CornerRadius = UDim.new(0, 6)

-- Pull & Export Row
local btnRow = Instance.new("Frame")
btnRow.Size = UDim2.new(1, 0, 0, 36)
btnRow.BackgroundTransparency = 1
btnRow.LayoutOrder = 4
btnRow.Parent = mainFrame

local rowLayout = Instance.new("UIListLayout")
rowLayout.FillDirection = Enum.FillDirection.Horizontal
rowLayout.Padding = UDim.new(0, 8)
rowLayout.Parent = btnRow

local uiPullBtn = Instance.new("TextButton")
uiPullBtn.Size = UDim2.new(0.5, -4, 1, 0)
uiPullBtn.BackgroundColor3 = Color3.fromRGB(45, 160, 90)
uiPullBtn.Text = "📥 Pull All Files"
uiPullBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiPullBtn.Font = Enum.Font.GothamBold
uiPullBtn.TextSize = 12
uiPullBtn.Parent = btnRow
Instance.new("UICorner", uiPullBtn).CornerRadius = UDim.new(0, 6)

local uiExportBtn = Instance.new("TextButton")
uiExportBtn.Size = UDim2.new(0.5, -4, 1, 0)
uiExportBtn.BackgroundColor3 = Color3.fromRGB(140, 70, 220)
uiExportBtn.Text = "📤 Export Game"
uiExportBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiExportBtn.Font = Enum.Font.GothamBold
uiExportBtn.TextSize = 12
uiExportBtn.Parent = btnRow
Instance.new("UICorner", uiExportBtn).CornerRadius = UDim.new(0, 6)

-- PATH B: Luau Runner Button
local uiRunnerBtn = Instance.new("TextButton")
uiRunnerBtn.Size = UDim2.new(1, 0, 0, 34)
uiRunnerBtn.BackgroundColor3 = Color3.fromRGB(220, 140, 30)
uiRunnerBtn.Text = "⚡ Run Luau (from IDE queue)"
uiRunnerBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiRunnerBtn.Font = Enum.Font.GothamBold
uiRunnerBtn.TextSize = 12
uiRunnerBtn.LayoutOrder = 5
uiRunnerBtn.Parent = mainFrame
Instance.new("UICorner", uiRunnerBtn).CornerRadius = UDim.new(0, 6)

-- PATH B: Send Tree Now Button
local uiTreeBtn = Instance.new("TextButton")
uiTreeBtn.Size = UDim2.new(1, 0, 0, 34)
uiTreeBtn.BackgroundColor3 = Color3.fromRGB(30, 160, 180)
uiTreeBtn.Text = "🌳 Push DataModel Tree Now"
uiTreeBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
uiTreeBtn.Font = Enum.Font.GothamBold
uiTreeBtn.TextSize = 12
uiTreeBtn.LayoutOrder = 6
uiTreeBtn.Parent = mainFrame
Instance.new("UICorner", uiTreeBtn).CornerRadius = UDim.new(0, 6)

-- Status label for Path B features
local pathBStatus = Instance.new("TextLabel")
pathBStatus.Size = UDim2.new(1, 0, 0, 20)
pathBStatus.BackgroundTransparency = 1
pathBStatus.Text = "Luau Runner: Idle | Console: Streaming"
pathBStatus.TextColor3 = Color3.fromRGB(120, 200, 120)
pathBStatus.Font = Enum.Font.Gotham
pathBStatus.TextSize = 10
pathBStatus.TextXAlignment = Enum.TextXAlignment.Left
pathBStatus.LayoutOrder = 7
pathBStatus.Parent = mainFrame

-- ═══════════════════════════════════════════════════════════════════════════
-- Update UI
-- ═══════════════════════════════════════════════════════════════════════════

local function updateUI()
    if isConnected then
        statusText.Text = "Status: 🟢 Connected"
        statusText.TextColor3 = Color3.fromRGB(80, 220, 120)
        projectText.Text = "Project: " .. activeProjectName
        filesText.Text = "Tracked Files: " .. tostring(trackedFilesCount)
        uiConnectBtn.Text = "Disconnect"
        uiConnectBtn.BackgroundColor3 = Color3.fromRGB(220, 60, 60)
        pathBStatus.Text = "⚡ Luau Runner: Active | 🔴 Console: Streaming"
        pathBStatus.TextColor3 = Color3.fromRGB(80, 220, 120)
    else
        statusText.Text = "Status: 🔴 Offline"
        statusText.TextColor3 = Color3.fromRGB(240, 90, 90)
        projectText.Text = "Project: Disconnected"
        filesText.Text = "Tracked Files: 0"
        uiConnectBtn.Text = "Connect to Blox Sync Server"
        uiConnectBtn.BackgroundColor3 = Color3.fromRGB(0, 150, 255)
        pathBStatus.Text = "Luau Runner: Idle | Console: Idle"
        pathBStatus.TextColor3 = Color3.fromRGB(120, 120, 130)
    end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- Core Functions (unchanged from v2.0)
-- ═══════════════════════════════════════════════════════════════════════════

local function pullAllFiles()
    log("Pulling all files from server...", "INFO")
    local success, response = httpRequest("/files", "GET")
    if success and response.files then
        activeProjectName  = response.projectName or "DefaultProject"
        trackedFilesCount  = #response.files
        for _, fileData in ipairs(response.files) do
            applyScriptChange({
                action     = "update",
                scriptInfo = fileData.scriptInfo,
                content    = fileData.content,
                guid       = fileData.guid
            })
        end
        ChangeHistoryService:SetWaypoint("Pulled files from Blox Sync")
        log("Successfully pulled " .. #response.files .. " files!", "INFO")
        updateUI()
    else
        log("Failed to pull files: " .. tostring(response), "ERROR")
    end
end

local function exportGameScripts()
    log("Scanning Studio game scripts for export...", "INFO")
    local scriptsToExport = {}

    local function scanInstance(parent)
        for _, child in ipairs(parent:GetChildren()) do
            if child:IsA("LuaSourceContainer") and not child:FindFirstAncestorOfClass("CoreGui") then
                local robloxHierarchy = child.Parent:GetFullName()
                table.insert(scriptsToExport, {
                    fullRobloxPath = robloxHierarchy .. "." .. child.Name,
                    scriptName     = child.Name,
                    scriptType     = child.ClassName,
                    content        = child.Source,
                    guid           = child:GetAttribute("BloxSyncGUID") or child:GetAttribute("BridgeGUID")
                })
            elseif (child:IsA("ScreenGui") or child:IsA("LayerCollector")) and child.Parent:IsA("StarterGui") then
                local hasScript = false
                for _, desc in ipairs(child:GetDescendants()) do
                    if desc:IsA("LuaSourceContainer") then hasScript = true; break end
                end
                if not hasScript then
                    local robloxHierarchy = child:GetFullName()
                    table.insert(scriptsToExport, {
                        fullRobloxPath = robloxHierarchy .. "." .. child.Name .. "Controller",
                        scriptName     = child.Name .. "Controller",
                        scriptType     = "LocalScript",
                        content        = "-- Client script for ScreenGui: " .. child.Name .. "\nlocal Players = game:GetService(\"Players\")\nlocal localPlayer = Players.LocalPlayer\n\nprint(\"" .. child.Name .. " UI initialized for:\", localPlayer.Name)\n"
                    })
                end
            end
            scanInstance(child)
        end
    end

    scanInstance(game:GetService("ReplicatedStorage"))
    scanInstance(game:GetService("ServerScriptService"))
    scanInstance(game:GetService("ServerStorage"))
    scanInstance(game:GetService("StarterGui"))
    scanInstance(game:GetService("StarterPack"))
    scanInstance(game:GetService("Workspace"))
    scanInstance(game:GetService("StarterPlayer"))

    log("Found " .. #scriptsToExport .. " script(s) to export. Sending to server...", "INFO")
    local success, response = httpRequest("/sync-from-studio", "POST", { scripts = scriptsToExport })
    if success then
        log("Successfully exported " .. tostring(response.count) .. " script(s) to IDE project!", "INFO")
    else
        log("Failed to export scripts: " .. tostring(response), "ERROR")
    end
end

local function pollChanges()
    if not isConnected or isSyncing then return end
    isSyncing = true

    local success, response = httpRequest("/changes?since=" .. tostring(lastSyncTimestamp), "GET")
    if success then
        if response.timestamp then lastSyncTimestamp = response.timestamp end
        if response.projectName then activeProjectName = response.projectName end
        if response.changes and #response.changes > 0 then
            for _, change in ipairs(response.changes) do
                applyScriptChange(change)
            end
            ChangeHistoryService:SetWaypoint("Synced changes from Blox Sync")
        end
        updateUI()
    else
        log("Server disconnected or unreachable.", "WARN")
        isConnected = false
        updateUI()
    end

    isSyncing = false
end

local function toggleConnection()
    if isConnected then
        isConnected = false
        log("Disconnected from Blox Sync server.", "INFO")
        updateUI()
    else
        log("Connecting to Blox Sync server at " .. CONFIG.serverUrl .. "...", "INFO")
        local success, response = httpRequest("/heartbeat", "POST", { timestamp = os.time() })
        if success then
            isConnected       = true
            activeProjectName = response.activeProject or "DefaultProject"
            log("Connected to project: " .. activeProjectName, "INFO")
            -- Push initial tree on connect
            task.delay(1, buildAndSendTree)
            pullAllFiles()
        else
            log("Could not connect to " .. CONFIG.serverUrl .. ". Make sure server is running!", "ERROR")
            isConnected = false
            updateUI()
        end
    end
end

-- ═══════════════════════════════════════════════════════════════════════════
-- Events & Button Listeners
-- ═══════════════════════════════════════════════════════════════════════════

uiConnectBtn.MouseButton1Click:Connect(toggleConnection)
uiPullBtn.MouseButton1Click:Connect(pullAllFiles)
uiExportBtn.MouseButton1Click:Connect(exportGameScripts)
statusButton.Click:Connect(function() widget.Enabled = not widget.Enabled end)

uiRunnerBtn.MouseButton1Click:Connect(function()
    if not isConnected then
        log("Cannot run Luau: not connected to Blox Sync server.", "WARN")
        return
    end
    log("Manually polling execute queue...", "INFO")
    processExecuteQueue()
end)

uiTreeBtn.MouseButton1Click:Connect(function()
    if not isConnected then
        log("Cannot send tree: not connected.", "WARN")
        return
    end
    log("Sending DataModel tree snapshot...", "INFO")
    buildAndSendTree()
    log("DataModel tree sent to Desktop App.", "INFO")
end)

-- ═══════════════════════════════════════════════════════════════════════════
-- Background Loops
-- ═══════════════════════════════════════════════════════════════════════════

-- Main sync + execute poll loop
task.spawn(function()
    while true do
        task.wait(CONFIG.pollInterval)
        if isConnected then
            pollChanges()
            processExecuteQueue()  -- PATH B: also drain execute queue each poll
        end
    end
end)

-- Heartbeat loop
task.spawn(function()
    while true do
        task.wait(CONFIG.heartbeatInterval)
        if isConnected then
            httpRequest("/heartbeat", "POST", { timestamp = os.time() })
        end
    end
end)

-- PATH B: DataModel tree loop (every treeInterval seconds)
task.spawn(function()
    while true do
        task.wait(CONFIG.treeInterval)
        if isConnected then
            buildAndSendTree()
        end
    end
end)

-- PATH B: LogService flush loop (every logFlushInterval seconds)
task.spawn(function()
    while true do
        task.wait(CONFIG.logFlushInterval)
        flushStudioLogs()
    end
end)

-- Auto Connect
if CONFIG.autoConnect then
    task.delay(1, function()
        toggleConnection()
    end)
end

log("Blox Sync Plugin v2.2 loaded — Luau Runner + Tree Inspector + Console Streaming active!", "INFO")

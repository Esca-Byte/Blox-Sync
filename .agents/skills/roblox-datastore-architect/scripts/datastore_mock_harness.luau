--!strict
-- scripts/datastore_mock_harness.luau
-- In-memory DataStore mock harness for testing player persistence without network latency or API limits.

local MockDataStoreService = {}
local stores: { [string]: { [string]: any } } = {}

local MockStore = {}
MockStore.__index = MockStore

function MockStore:GetAsync(key: string): (any, any)
    local data = self._data[key]
    if data == nil then
        return nil, nil
    end
    -- Deep copy to prevent external reference mutations
    return game:GetService("HttpService"):JSONDecode(game:GetService("HttpService"):JSONEncode(data)), nil
end

function MockStore:SetAsync(key: string, value: any)
    self._data[key] = game:GetService("HttpService"):JSONDecode(game:GetService("HttpService"):JSONEncode(value))
end

function MockStore:UpdateAsync(key: string, transformFunction: (any, any) -> (any, any))
    local current = self:GetAsync(key)
    local updated = transformFunction(current, nil)
    if updated ~= nil then
        self:SetAsync(key, updated)
    end
    return updated
end

function MockDataStoreService:GetDataStore(name: string, scope: string?)
    local id = name .. "/" .. (scope or "global")
    if not stores[id] then
        stores[id] = setmetatable({ _data = {} }, MockStore)
    end
    return stores[id]
end

-- Example test execution
print("💾 Initializing MockDataStore test harness...")
local testStore = MockDataStoreService:GetDataStore("PlayerData", "v1")

-- Test 1: Write and Read
testStore:SetAsync("User_12345", { Coins = 500, Level = 5 })
local saved = testStore:GetAsync("User_12345")
assert(saved.Coins == 500, "Coins should match 500")

-- Test 2: UpdateAsync atomic transformation
testStore:UpdateAsync("User_12345", function(old)
    old.Coins = old.Coins + 250
    return old
end)

local updated = testStore:GetAsync("User_12345")
assert(updated.Coins == 750, "Coins should now be 750")
print("✅ All MockDataStore verification tests passed!")

return MockDataStoreService

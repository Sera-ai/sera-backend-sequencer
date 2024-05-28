-- Import necessary modules
local http = require "resty.http"
local cjson = require "cjson.safe"

-- Define the fictional endpoint and parameters for the POST request
local endpoint = {{endpoint}}
local requestData = {
    {{#each requestData}}
    {{@key}} = '{{this}}',
    {{/each}}
}

-- Function to perform the GET request for additional data
local function {{sequenceName}}({{parameters}})
    {{#each actions}}
    -- Sub-actions group
    {{#each this}}
    {{this}}
    {{/each}}
    {{/each}}
end

-- Execute the initial POST request
{{sequenceName}}()
-- Import necessary modules
local http = require "resty.http"
local cjson = require "cjson.safe"
local learning_mode = require "learning_mode"
local request_data = require "request_data"
local oas_check = require "oas_check"
local oas_handler = require "oas_handler"
local mongo = require "mongo_handler"
local ngx = ngx

-- Dynamic imports
{{#each imports}}
local {{alias}} = require "{{module}}"
{{/each}}

-- Connection pool settings
local httpc = http.new()
httpc:set_keepalive(60000, 100) -- keep connections alive for 60 seconds, max 100 connections

local function async_after_tasks()
    {{! Placeholder for after tasks }}
    {{{after_tasks}}}
end

local function send_response(sera_res, res)
    -- -- Set response headers
    -- for k, v in pairs(res.headers) do
    --     ngx.header[k] = v
    -- end

    if sera_res.headers then
        for k, v in pairs(sera_res.headers) do
            ngx.header[k] = v
        end    
    end
    
    -- Return the response body
    -- Set the status code
    ngx.status = sera_res.status or res.status
    -- Encode the body
    local body = cjson.encode(sera_res.body)

    -- Set correct Content-Length and Content-Type headers
    ngx.header["Content-Length"] = #body

    -- Send the body
    ngx.say(body)

    ngx.eof()

    -- Spawn a worker thread to handle logging asynchronously
    ngx.thread.spawn(learning_mode.log_request, res)

    {{! Placeholder for running after tasks }}
    {{{should_run_after_tasks}}}
end

local function sera_response_middleware(res, requestDetails)
    local response_body = res.body
    local response_json = cjson.decode(response_body)
    local response_json_replica = cjson.decode(response_body)
    local body_data = ngx.req.get_body_data()
    local body_json = cjson.decode(body_data)

    {{! Placeholder for request code }}
    {{{request_initialization}}}

    {{{response_initialization}}}

    {{#each response_functions}}
    local function {{name}}({{#if params}}{{params}}{{/if}})
        {{{code}}}
    end
    {{/each}}

    {{#each response_functions}}
    {{{use}}}
    {{/each}}

    {{{response_finalization}}}

    send_response(sera_res, res)
end

-- Function to handle the response
local function handle_response(res, requestDetails)
    if not res then
        ngx.log(ngx.ERR, 'Error making request')
        ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    end

    if res.status >= 400 then
        ngx.log(ngx.ERR, 'Request failed with status: ', res.status)
        ngx.status = res.status
        ngx.say(res.body)
        return ngx.exit(res.status)
    end

    local oas = cjson.decode(ngx.var.oas_data)
    local host_data = cjson.decode(ngx.var.host_data)
    -- Validate the response against the OAS
    local valid, error_message = oas_check.validate_response(oas, res)
    if not valid and host_data.sera_config.strict then
        ngx.log(ngx.ERR, "Response validation failed: " .. error_message)
        ngx.status = ngx.HTTP_INTERNAL_SERVER_ERROR
        ngx.say("Invalid response: " .. error_message)
        return ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    end

    sera_response_middleware(res, requestDetails)
end

local function send_request(requestDetails)
    local target_url = requestDetails.request_target_url
    local headers = requestDetails.header or {}
    local cookie = requestDetails.cookie or {}
    local query = requestDetails.query or {}
    local body = requestDetails.body or {}

    -- Append query parameters if they exist
    if next(query) then
        local query_string = ngx.encode_args(query)
        target_url = target_url .. "?" .. query_string
    end

    ngx.var.proxy_start_time = ngx.now()

    local res, err = httpc:request_uri(target_url, {
        method = ngx.var.request_method,
        headers = headers,
        query = query,
        body = cjson.encode(body),
        ssl_verify = false -- Add proper certificate verification as needed
    })

    ngx.var.proxy_finish_time = ngx.now()

    handle_response(res,requestDetails)
end


local function sera_request_middleware(request_target_url)
    ngx.req.read_body()
    local body_data = ngx.req.get_body_data()
    local body_json = cjson.decode(body_data)

    {{! Placeholder for request code }}
    {{{request_initialization}}}

    {{#each request_functions}}
    local function {{name}}({{#if params}}{{params}}{{/if}})
        {{{code}}}
    end
    {{/each}}

    {{#each request_functions}}
    {{{use}}}
    {{/each}}

    {{{request_finalization}}}
    send_request(requestDetails)
end

-- Function to perform the POST request
local function make_request(data)
    -- First, check authentication credentials
    if data then
        local host_data_raw = mongo.get_by_document_id("sera_hosts", data.document_id)

        -- Parse the JSON response
        local host_data = cjson.decode(host_data_raw)
        if not host_data then
            ngx.log(ngx.ERR, "Failed to decode MongoDB response")
            ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
        end

        ngx.var.host_data = cjson.encode(host_data)

        local protocol = host_data.sera_config.https and "https://" or "http://"
        local db_entry_host = protocol .. host_data.frwd_config.host .. ":" .. host_data.frwd_config.port

        local oas_res, err = oas_handler.handle_oas(data.oas_id, host_data)
     
        if oas_res then
            ngx.var.proxy_script_start_time = ngx.now()

            local headers, target_url = request_data.extract_headers_and_url(db_entry_host)
        
            sera_request_middleware(target_url)
        end
    else
        ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    end
end

return {
    make_request = make_request
}
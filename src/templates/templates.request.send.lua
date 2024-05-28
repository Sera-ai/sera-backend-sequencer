local function {{functionName}}({{parameters}})
    local httpc = http.new()
    local res, err = httpc:request_uri({{endpoint}}, {
        method = {{method}},
        headers = {
            {{#each headers}}
            ['{{@key}}'] = '{{this}}',
            {{/each}}
        },
        ssl_verify = false
    })

    if not res then
        ngx.log(ngx.ERR, 'Error making GET request: ', err)
        ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    end

    -- Check if the request was successful
    if res.status ~= 200 then
        ngx.log(ngx.ERR, 'GET request failed with status: ', res.status)
        ngx.exit(res.status)
    end

    return res -- Return the response

end
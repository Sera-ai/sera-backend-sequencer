function request_initialization(node) {
    const items = [];

    node.outputHandles.forEach((handle) => {
        const [type, value] = handle.split(".");

        if (type !== "sera") {
            let luaCode;
            switch (type) {
                case 'query':
                    luaCode = `local ${handle.replace(/[^a-zA-Z0-9_]/g, '_')} = ngx.var.arg_${value}`;
                    break;
                case 'header':
                    luaCode = `local ${handle.replace(/[^a-zA-Z0-9_]/g, '_')} = ngx.req.get_headers()["${value}"]`;
                    break;
                case 'body':
                    luaCode = `local ${handle.replace(/[^a-zA-Z0-9_]/g, '_')} = body_json["${value}"]`;
                    break;
                case 'cookie':
                    luaCode = `local ${handle.replace(/[^a-zA-Z0-9_]/g, '_')} = ngx.var.cookie_${value}`;
                    break;
                default:
                    luaCode = `-- Unsupported type: ${type}`;
            }
            items.push(luaCode);
        }
    });

    return items.join("\n");
}

function request_finalization(node) {
    const items = {};

    node.inputHandles.forEach((handle) => {
        const [type, value] = handle.split(".");

        if (type !== "sera") {
            const inputs = node.input.filter((nd) => nd.targetHandle == handle)[0];
            (items[type] = items[type] ?? []).push(`["${value}"] = ${inputs.sourceHandle.replace(/[^a-zA-Z0-9_]/g, '_')}`)
        }
    });

    const typeObjects = []

    Object.keys(items).map((item) => {
        typeObjects.push(`${item} = {
            ${items[item].join(",\n")}
        }`)
    })

    const fullReturn = `local requestDetails = {
        request_target_url = request_target_url,
        ${typeObjects.join(",\n")}
    }`


    return fullReturn;
}

function response_initialization(node) {
    const items = [];

    node.outputHandles.forEach((handle) => {
        const [type, value] = handle.split(".");

        if (type !== "sera") {
            let luaCode;
            switch (type) {
                case 'headers':
                    luaCode = `local ${handle.replace(/[^a-zA-Z0-9_]/g, '_')} = res.headers["${value}"]`;
                    break;
                case 'body':
                    luaCode = `local ${handle.replace(/[^a-zA-Z0-9_]/g, '_')} = response_json["${value}"] or response_json[1]["${value}"]`;
                    break;
                default: {
                    if (type.includes("body")) {
                        luaCode = `local ${handle.replace(/[^a-zA-Z0-9_]/g, '_')} = response_json["${value}"] or response_json[1]["${value}"]`;
                    } else {
                        luaCode = `-- Unsupported type: ${type}`;
                    }
                }
            }
            items.push(luaCode);
        }
    });

    return items.join("\n");
}

function response_finalization(node) {
    const items = {};
    const replacement_values = {};

    node.inputHandles.forEach((handle) => {
        const [type, value] = handle.split(".");
        console.log(handle)
        if (type.split(" ")[0] == "body") {
            replacement_values[value] = (node.input.filter((nd) => nd.targetHandle == handle)[0]).sourceHandle;
        } else if (type !== "sera") {
            const inputs = node.input.filter((nd) => nd.targetHandle == handle)[0];
            (items[type] = items[type] ?? []).push(`["${value}"] = ${inputs.sourceHandle.replace(/[^a-zA-Z0-9_]/g, '_')}`)
        }
    });

    const typeObjects = []

    Object.keys(items).map((item) => {
        typeObjects.push(`["${item.replace(/body \((\d{3})\)/g, "$1")}"] = {
            ${items[item].join(",\n")}
        }`)
    })



    const fullReturn = `

    local sera_res = {
        ${typeObjects.join(",\n")}
    }

    local replacement_values = {
    ${Object.keys(replacement_values).map((key) => (`["${key}"] = "${replacement_values[key]}"`)).join(",\n")}
    }
    sera_res.headers = request_data.mergeTables(sera_res.headers, res.headers)

    -- Update JSON values in the response body
    if type(response_json) == "table" then
        if #response_json > 0 then
            -- Handle JSON array case
            for i, obj in ipairs(response_json) do
                request_data.update_json_values(response_json_replica[i], obj, replacement_values, sera_res)
            end
        else
            -- Handle JSON object case
            request_data.update_json_values(response_json_replica, response_json, replacement_values, sera_res)
        end
    end
        
    sera_res.body = response_json
    `


    return fullReturn;
}


module.exports = {
    request_initialization,
    request_finalization,
    response_initialization,
    response_finalization
}
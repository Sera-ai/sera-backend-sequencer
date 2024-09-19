export function event_initialization(node) {
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
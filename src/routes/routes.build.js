

const build = async (req, res) => {
    //Step 1 - Get the request datbase entries
    const { sera_endpoint } = req;
    const { host_id: host, builder_id: builder } = sera_endpoint
    const { oas_id: oas } = host
    const { nodes, edges } = builder


    //1. Create first checks in the Lua script:

    // 1.1 - Is OAS Required?
    // 1.2 - Is OAS Found?
    // 1.3 - Is OAS Strict?
    // 1.4 - Does OAS Match?

    // 2. Build Sequence Graph into Lua

    // 2.1 Request Init
    // 2.2 Request Nodes
    // 2.3 Request Send

    // 2.4 Response Init
    // 2.5 Response Nodes
    // 2.6 Response Send


};

module.exports = {
    build,
};

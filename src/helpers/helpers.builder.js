const Hosts = require('../models/models.hosts');
const Endpoints = require('../models/models.endpoints');
const Plugins = require('../models/models.plugins');
const OAS = require('../models/models.oas');
const Builder = require('../models/models.builder');
const Nodes = require('../models/models.nodes');
const { getDataFromPath } = require('./helpers.general');

const getPathways = (path) => {
    return path.split("/").slice(1).map((segment, index, arr) => (index === arr.length - 1) ? segment : "/" + segment);
};

const getRefData = (ref, oas) => {
    return getDataFromPath(ref.split("/").slice(1), oas).properties;
};

const getFieldsForNode = async (nodeData, method, pathwayData, oas) => {
    let fields = { in: [], out: [] };

    if (method !== "POST" || !pathwayData) {
        if ([2, 4].includes(nodeData.headerType)) {
            fields["in"] = [];
        }

        if ([1, 3].includes(nodeData.headerType)) {
            fields["out"] = [];
        }
        return fields;
    }

    if ([2, 4].includes(nodeData.headerType)) {
        fields["in"] = getRefData(pathwayData.requestBody.content[Object.keys(pathwayData.requestBody.content)[0]].schema.$ref, oas);
    }

    if ([1, 3].includes(nodeData.headerType)) {
        fields["out"] = getRefData(pathwayData.responses["201"].content[Object.keys(pathwayData.responses["201"].content)[0]].schema.$ref, oas);
        (fields["out"]["__header"] ??= {})["status"] = "201";
    }

    return fields;
};

const fetchNodeData = async (node) => {
    if (!node.id) return null;
    return (await Nodes.findById(node.id)).toObject();
};

const updateNodeData = async (node, data, method, pathwayData, oas) => {
    const fields = await getFieldsForNode(data, method, pathwayData, oas);
    if (node.id) {
        return await Nodes.findByIdAndUpdate(node.id, { fields });
    }
    return await new Nodes({ fields }).save();
};

async function getBuilderNodes(req, res) {
    let strict = true;
    let { protocol, hostname, url: path, method } = req;
    url = `${protocol}://${hostname}${path}`;

    try {

        const parsedInit = new URL(url)
        const host = (await Hosts.findOne({ "hostname": parsedInit.host.split(":")[0] })).toObject();
        if (!host) throw { error: "NoHost" }
        strict = host.strict == "true"
        const parsed = new URL(`${parsedInit.protocol}//${host.forwards}${req.url}`)
        const oasUrl = `${parsed.protocol}//${host.forwards}`
        url = oasUrl + req.url
        const oas = (await OAS.findOne({ servers: { $elemMatch: { url: oasUrl } } })).toObject();
        const endpoint = (await Endpoints.findOne({ "host_id": host._id, endpoint: path, method: method })).toObject();
        if (!endpoint) throw { error: "NoEndpoint", host: host._id }

        const builder = await Builder.findById(endpoint.builder_id)
        if (!builder) throw { error: "NoBuilder", host: host._id }

        //grab or setup nodes
        let { nodes } = fragileBuilder = builder,
            change = false,
            nodesToSend = [];

        const nodeToSave = await Promise.all(nodes.map(async (node) => {
            if (node.type == "functionNode") node["id"] = node.id
            const oasPathways = getPathways(parsed.pathname);
            const pathwayData = getDataFromPath(oasPathways, oas.paths);
            const nodeData = await fetchNodeData(node);

            let updatedNode;
            if (nodeData && !nodeData) {
                updatedNode = await updateNodeData(node, nodeData, method, pathwayData, oas);
            } else if (node.data?.headerType) {
                updatedNode = await updateNodeData(node, node.data, method, pathwayData, oas);
            }

            const nodeToSendItem = {
                ...node,
                id: updatedNode?._id,
                data: updatedNode || nodeData,
                fields: updatedNode
            };

            nodesToSend.push(nodeToSendItem);
            return node;
        }));

        if (nodeToSave && change) {
            Builder.findByIdAndUpdate(endpoint.builder_id, { "nodes": nodeToSave }).then((e) => { })
        }
        fragileBuilder.nodes = nodesToSend
        return { issue: false, oas: oas, endpoint: endpoint, builder: fragileBuilder, host, strict, requestData: { url, method, path }, req }
    }
    catch (error) {
        switch (error.error) {
            case "NoHost":
                return { issue: error.message, strict, requestData: { url, method, path }, req };
            case "NoEndpoint":
                return { issue: error, strict, requestData: { url, method, path }, req }
            case "NoBuilder":
                return { issue: error, strict, requestData: { url, method, path }, req }
            default:
                return { issue: error.message, strict, requestData: { url, method, path }, req };
        }
    }
}



module.exports = {
    getBuilderNodes,
    fetchNodeData
}


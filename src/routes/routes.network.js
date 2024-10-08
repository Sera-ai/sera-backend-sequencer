import fastifyPlugin from 'fastify-plugin';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';

const { default: hosts_model } = await import("../models/models.hosts.cjs");
const { default: endpoints_model } = await import("../models/models.endpoints.cjs");
const { default: endpoint_builder_model } = await import("../models/models.endpoint_builder.cjs");
const { default: nodes_model } = await import('../models/models.builder_node.cjs');
const { default: edges_model } = await import('../models/models.builder_edge.cjs');


import { builderFlow } from '../helpers/helpers.sequence.js';
import { request_initialization, request_finalization, response_initialization, response_finalization } from '../scripts/scripts.lua.apinode.js';

Handlebars.registerHelper('wrapInQuotes', function (variable) {
    return '"' + variable + '"';
});

// Function to process nodes
function processNodes(nodeIds, nodes, edges) {
    return nodeIds.map(id => {
        const node = nodes.find(node => node.id === id);
        if (!node) return null;

        const inputEdges = edges.filter(edge => edge.target === id);
        const outputEdges = edges.filter(edge => edge.source === id);
        const inputHandles = inputEdges.map(edge => edge.targetHandle).filter(handle => handle !== undefined);
        const outputHandles = outputEdges.map(edge => edge.sourceHandle).filter(handle => handle !== undefined);

        let nodeData = { ...node.toObject() }; // Make a shallow copy of the node object
        nodeData["input"] = inputEdges;
        nodeData["output"] = outputEdges;
        nodeData["inputHandles"] = inputHandles;
        nodeData["outputHandles"] = outputHandles;

        return nodeData;
    }).filter(item => item !== null); // Filter out any null values
}

// Fastify route
async function routes(fastify, options) {
    fastify.post("/:builderId", async (request, reply) => {

        const { nodes, edges } = await endpoint_builder_model.findOne({ _id: request.params.builderId }).populate(["nodes", "edges"]);
        const endpoint_data = await endpoints_model.findOne({ builder_id: request.params.builderId });
        const host_data = await hosts_model.findById(endpoint_data.host_id);

        // 1. Get our node sequence
        const { masterNodes, connectedSequences } = builderFlow({ nodes, edges });

        const requestNodeIds = connectedSequences.filter((seq) => seq[0] == masterNodes.request[0])[0];
        const responseNodeIds = connectedSequences.filter((seq) => seq[0] == masterNodes.response[0])[0];

        // 2. Build out sequence paths
        const requestNodes = processNodes(requestNodeIds, nodes, edges);
        const responseNodes = processNodes(responseNodeIds, nodes, edges);

        // 3. Build lua script
        const mainTemplate = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '../templates/main.lua.template'), 'utf8');
        const handlebarTemplate = Handlebars.compile(mainTemplate);

        let templateChanges = {};

        requestNodes.forEach((node) => {
            switch (node.type) {
                case "apiNode":
                    switch (node.data.headerType) {
                        case 1:
                            templateChanges["request_initialization"] = request_initialization(node);
                            break;
                        case 2:
                            templateChanges["request_finalization"] = request_finalization(node);
                            break;
                    }
                    break;
                case "scriptNode":
                    (templateChanges.request_functions = templateChanges.request_functions || []).push({
                        name: node.id,
                        edges: edges
                            .filter((edge) => edge.target === node.id && !edge.targetHandle.includes("sera_start"))
                            .map((edge) => `${edge.source}_${normalizeVarName(edge.sourceHandle)}`),
                        code: node.data.inputData,
                        use: `${node.id}("value1", "value2")`
                    });
                    break;
            }
        });

        responseNodes.forEach((node) => {
            switch (node.type) {
                case "apiNode":
                    switch (node.data.headerType) {
                        case 3:
                            templateChanges["response_initialization"] = response_initialization(node);
                            break;
                        case 4:
                            templateChanges["response_finalization"] = response_finalization(node);
                            break;
                    }
                    break;
                case "scriptNode":
                    (templateChanges.response_scipt_function = templateChanges.response_scipt_function || []).push({
                        name: node.id,
                        edges: edges
                            .filter((edge) => edge.target === node.id && !edge.targetHandle.includes("sera_start"))
                            .map((edge) => `${edge.source}_${normalizeVarName(edge.sourceHandle)}`),
                        code: node.data.inputData,
                        use: `${node.id}("value1", "value2")`
                    });
                    break;
            }
        });

        nodes.forEach((node) => {
            if (node.type == "sendEventNode") {
                const eventData = edges.filter((edge) => edge.target == node.id).map((edge) => `"${edge.sourceHandle}"`);
                console.log(eventData)
                if (eventData)
                    (templateChanges.event_node_function = templateChanges.event_node_function || []).push({
                        nodeId: node.id,
                        eventTitle: node.data.inputData || "genericBuilderEvent",
                        eventData: eventData
                    })
            }
        })

        // 4. Save lua script
        const compiledScript = handlebarTemplate(templateChanges);

        fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), `../lua-scripts/generated/${request.params.builderId}.lua`), compiledScript);

        // 5. Call nginx server
        const data = JSON.stringify({
            path: `${host_data.hostname}:${endpoint_data.endpoint}:${endpoint_data.method.toUpperCase()}`,
            filename: `${request.params.builderId}.lua`,
            document_id: host_data.id,
            oas_id: host_data.oas_spec
        });

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        try {
            const response = await axios.post('https://manage.sera/update-map', data, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-sera-service': "be_nginx"
                },
                httpsAgent
            });
            reply.header('Content-Type', 'application/json');
            reply.send(response.data);
        } catch (error) {
            console.error('Request error:', error);
            reply.status(500).send('Error updating mapping2');
        }

    });
}

function normalizeVarName(name) {
    let normalized = name.replace(/-/g, "_").replace(/[()]/g, "");

    if (!/^[a-zA-Z_$]/.test(normalized[0])) {
        normalized = "_" + normalized;
    }

    normalized = normalized.replace(/[^a-zA-Z0-9_$]/g, "_");

    return normalized;
}

export default fastifyPlugin(routes);

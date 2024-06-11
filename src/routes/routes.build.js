const express = require('express');
const router = express.Router();
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const hostMongo = require("../models/models.hosts");
const endpointMongo = require("../models/models.endpoints");
const builderMongo = require("../models/models.builder");
require("../models/models.nodes");
require("../models/models.edges");

const { builderFlow } = require("../helpers/helpers.sequence");
const { request_initialization, request_finalization, response_initialization, response_finalization } = require('../scripts/scripts.apinode');


router.post("/:builderId", async (req, res) => {
    const { nodes, edges } = await builderMongo.findOne({ _id: req.params.builderId }).populate(["nodes", "edges"])
    const endpoint_data = await endpointMongo.findOne({ builder_id: req.params.builderId })
    const host_data = await hostMongo.findById(endpoint_data.host_id)

    // 1. Get our node sequence
    const { masterNodes, connectedSequences } = builderFlow({ nodes, edges, res });


    const requestNodeIds = connectedSequences.filter((seq) => seq[0] == masterNodes.request[0])[0]
    const responseNodeIds = connectedSequences.filter((seq) => seq[0] == masterNodes.response[0])[0]
    //2. Build out sequence paths

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

    const requestNodes = processNodes(requestNodeIds, nodes, edges);
    const responseNodes = processNodes(responseNodeIds, nodes, edges);


    //3. Build lua script
    // Read the template
    const mainTemplate = fs.readFileSync(path.join(__dirname, '../templates/templates.main.lua'), 'utf8');
    const handlebarTemplate = Handlebars.compile(mainTemplate);

    let templateChanges = {}

    requestNodes.map((node) => {
        switch (node.type) {
            case "apiNode": {
                switch (node.data.headerType) {
                    case 1: templateChanges["request_initialization"] = request_initialization(node); break;
                    case 2: templateChanges["request_finalization"] = request_finalization(node); break;
                }
                break;
            }
            case "scriptNode":
                {
                    templateChanges.request_functions ?? []
                        (templateChanges.request_functions = templateChanges.request_functions ?? []).push({
                            name: node.id,
                            params: 'param1, param2',
                            code: node.data.input,
                            use: `${node.id}("value1", "value2")`
                        });
                    break;
                }

        }
    })

    responseNodes.map((node) => {
        switch (node.type) {
            case "apiNode": {
                switch (node.data.headerType) {
                    case 3: templateChanges["response_initialization"] = response_initialization(node); break;
                    case 4: templateChanges["response_finalization"] = response_finalization(node); break;
                }
                break;
            }
            case "scriptNode":
                {
                    templateChanges.response_functions ?? []
                        (templateChanges.response_functions = templateChanges.response_functions ?? []).push({
                            name: node.id,
                            params: 'param1, param2',
                            code: node.data.input,
                            use: `${node.id}("value1", "value2")`
                        });
                    break;
                }
        }
    })



    //4. Save lua script
    const compiledScript = handlebarTemplate(templateChanges);
    fs.writeFileSync(`/workspace/.devcontainer/lua-scripts/generated/${req.params.builderId}.lua`, compiledScript);

    //5. call nginx server

    async function updateMapping() {
        console.log(`${endpoint_data.endpoint}`);
        console.log(JSON.stringify({ test: `${endpoint_data.endpoint}` }));

        const data = JSON.stringify({
            path: `${host_data.hostname}:${endpoint_data.endpoint}:${endpoint_data.method.toUpperCase()}`,
            filename: `${req.params.builderId}.lua`,
            document_id: host_data.id,
            oas_id: host_data.oas_spec
        });

        console.log(data);

        try {
            const response = await axios.post('http://localhost/update-map', data, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-sera-service': "be_nginx"
                }
            });
            res.send(response.data);
        } catch (error) {
            console.error('Request error:', error);
        }
    }
    updateMapping();
});

module.exports = router;

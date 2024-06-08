const express = require('express');
const router = express.Router();

const { builderFlow } = require("../helpers/helpers.sequence");
const builderMongo = require("../models/models.builder")
require("../models/models.nodes");
require("../models/models.edges");

router.post("/:builderId", async (req, res) => {
    const { nodes, edges } = await builderMongo.findOne({ _id: req.params.builderId }).populate(["nodes", "edges"])

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

            return { [id]: nodeData };
        }).filter(item => item !== null); // Filter out any null values
    }

    const requestNodes = processNodes(requestNodeIds, nodes, edges);
    const responseNodes = processNodes(responseNodeIds, nodes, edges);

    console.log(requestNodes[0].eVkgMR3MLYTB)

    res.send(requestNodes)

    //3. Build lua script

    //4. Save lua script

    //5. call nginx server

});

module.exports = router;

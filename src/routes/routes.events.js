const fastifyPlugin = require('fastify-plugin');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

const hostMongo = require("../models/models.hosts");
const endpointMongo = require("../models/models.endpoints");
const builderMongo = require("../models/models.eventBuilder");
require("../models/models.nodes");
require("../models/models.edges");

const { eventBuilderFlow } = require("../helpers/helpers.sequence");

Handlebars.registerHelper('wrapInQuotes', function (variable) {
    return '"' + variable + '"';
});

// Fastify route
async function routes(fastify, options) {
    fastify.post("/:builderId", async (request, reply) => {

        const { nodes, edges, _id } = await builderMongo.findOne({ slug: request.params.builderId }).populate(["nodes", "edges"]);

        // 1. Get our node sequence
        const { connectedSequences } = eventBuilderFlow({ nodes, edges });
        // 2. Build out sequence paths
        //const allNodes = processNodes(nodes, edges);

        // 3. Build js script
        const mainTemplate = fs.readFileSync(path.join(__dirname, '../templates/main.js.template'), 'utf8');
        const handlebarTemplate = Handlebars.compile(mainTemplate);

        let templateChanges = { event_initialization: [] };

        connectedSequences.forEach((sequence, int) => {
            console.log("sequence", sequence)
            let originNode = sequence.filter(node_id => {
                return nodes.some(node => node.id === node_id && node.type === "eventNode");
            })

            let edgeData = sequence.filter(node_id => {
                return edges.some(edge => edge.source === node_id );
            }).map(node_id => {
                let relevantEdges = edges.filter(edge => edge.source === node_id && !edge.sourceHandle.includes("sera_end"));
                return relevantEdges.map(edge => `${edge.source}_${normalizeVarName(edge.sourceHandle)} = data['${edge.sourceHandle.split(".").join("']['")}']`);
            }).flat();
            

            console.log(edgeData)

            templateChanges.event_initialization.push({
                event_name: originNode[0],
                event_parts: [],
                part_list: sequence,
                first_part: sequence[1] || "",
                init_vars: edgeData
            })

            sequence.forEach((node_id, s_int) => {
                const node = nodes.filter((node) => node.id == node_id)[0]
                switch (node.type) {
                    case "scriptNode":
                        templateChanges.event_initialization[int].event_parts.push({
                            part_name: node.id,
                            code: node.data.inputData,
                            next_part: sequence[s_int + 1] || ""
                        });
                        break;
                }
            })
        });

        //console.log("lets save it", templateChanges)
        // 4. Save lua script
        const compiledScript = handlebarTemplate(templateChanges);
        console.log(compiledScript)

        fs.writeFileSync(path.join(__dirname, `../event-scripts/${_id}.js`), compiledScript);

        reply.send("success");
    });
}

function normalizeVarName(name) {
    // Replace invalid characters with underscores and remove parentheses
    let normalized = name.replace(/-/g, "_").replace(/[()]/g, "");

    // Ensure the name starts with a valid character
    if (!/^[a-zA-Z_$]/.test(normalized[0])) {
        normalized = "_" + normalized;
    }

    // Replace any sequence of characters that are not letters, numbers, or underscores with an underscore
    normalized = normalized.replace(/[^a-zA-Z0-9_$]/g, "_");

    return normalized;
}

module.exports = fastifyPlugin(routes);

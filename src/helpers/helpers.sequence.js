function findConnectedSequences(nodes, edges) {
    // Step 1: Build adjacency list and a set of target nodes
    const adjList = {};
    const targetNodes = new Set();

    for (let edge of edges) {
        if (!adjList[edge.source]) {
            adjList[edge.source] = [];
        }
        adjList[edge.source].push(edge.target);
        targetNodes.add(edge.target);
    }

    // Step 2: Identify starting nodes (nodes that are not targets)
    const startNodes = nodes.filter(node => !targetNodes.has(node.id)).map(node => node.id);

    // Step 3: Build sequences
    const sequences = [];

    for (let start of startNodes) {
        let current = start;
        const sequence = [current];

        while (adjList[current] && adjList[current].length) {
            current = adjList[current].pop();
            sequence.push(current);
        }

        // Check if sequence length is greater than 1 before pushing to result
        if (sequence.length > 1) {
            sequences.push(sequence);
        }
    }

    return sequences;
}

function beginsWith(arrays, id) {
    return arrays.findIndex(array => array[0] === id);
}

function anyStartsAndEndsWith(arrays, startId, endId) {
    return arrays.findIndex(array => array[0] === startId && array[array.length - 1] === endId);
}


function sequenceBuilder(req, sequence, builder) {
    const items = []
    const variables = []
    const additionalCheck = []

    sequence.map((id) => {
        builder.edges.map((edge) => {
            if ((edge.source == id || edge.target == id) && !items.includes(edge.id) && edge.sourceHandle.split("-")[3] !== "end" && edge.sourceHandle.split("-")[3] !== "start") items.push(edge.id)
        })
    })

    items.map((item) => {
        const edge = (builder.edges.filter((edge) => edge.id == item))[0]
        if (!variables.includes(edge.sourceHandle))
            !edge.sourceHandle.includes("end") && variables.push(edge.sourceHandle)

        if (!variables.includes(edge.targetHandle))
            !edge.targetHandle.includes("start") && variables.push(edge.targetHandle)
    })

    variables.map((item) => {
        additionalCheck.push(item.split("-")[3])
    })

    Object.keys(req.body).map((param) => {
        if (!additionalCheck.includes(`(${param})`)) variables.push(`an-extra-variable-${param}`)
    })

    //We have all of our variables
    return variables

    //So now we need to plugin these variables to the actual script

}


module.exports = {
    findConnectedSequences,
    beginsWith,
    anyStartsAndEndsWith,
    sequenceBuilder
}
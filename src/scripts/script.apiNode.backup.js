// scripts/script.apiNode.js
const https = require("https")

async function build({ allData, index, node, variables, params, script }) {
    switch (index) {
        case 0: return await create({ allData, variables, params, script })
        case 1: return await request({ allData, node, variables, script })
        case 2: return await response({ allData, variables, params, script })
        case 3: return await return_response({ allData, node, variables, script })
    }
}

async function create({ allData, variables, params, script }) {
    const requestFunc = "func" + generateRandomString()
    const paramObj = params.reduce((acc, item) => { return { ...acc, ...item } }, {});

    //begin script with external variables
    script = script + `\n[[Variables]]\n`

    //create Request function
    script = script + `\nasync function ${requestFunc}(){\n`

    //set variable
    script = script + `\n[[Link]]\n[[Request]]\n`

    //Script Starter
    script = script + `\n}\n${requestFunc}()\n`

    //create Return Function
    script = script + `\n[[Response]]\n`

    variables.map((variable) => {
        const variableName = variable.split("-")[3]
        let variableDeclaration = ""

        if (Object.keys(paramObj).includes(variableName)) {
            const value = allData.req.body[variableName]
            const output = `${typeof value === 'string' ? `"${value}"` : value}`;
            variableDeclaration = `let ${variable.replaceAll("-", "_")} = ${output}`;
        }
        //see if sequence start and end with same id for each variable. If so set it equal to the respective
        // Check if the variable declaration already exists in the script

        script = script.replace("[[Variables]]", `[[Variables]]\n${variableDeclaration}`);

    });

    return script
}

async function request({ allData, node, variables, script }) {

    let axiosConfig = {
        method: allData.req.method,
        url: allData.requestData.url,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }


    //Now we have to relink all the changes variables from the builder
    node.edges.map((edge) => {
        if (!edge.targetHandle.includes("start") && !edge.targetHandle.includes("end"))
            if (!edge.sourceHandle.includes("start") && !edge.sourceHandle.includes("end"))
                script = script.replace("[[Link]]", `[[Link]]\n${edge.targetHandle.replaceAll("-", "_")} = ${edge.sourceHandle.replaceAll("-", "_")} ?? null`);
    })

    script = script.replace("[[Request]]", `\ntry {

    ${!isEmpty(variables) &&
        `let data = {${(variables)
            .filter((x) => x.includes(`flow-target-${node.id}`))
            .map((param) => {
                return `${param.split("-")[3]}: ${param.replaceAll("-", "_")}`
            })
        }\}`
        }

        ${!isEmpty(variables) &&
        variables.filter((variable) => variable.includes("an-extra-variable"))
            .map((variable) => {
                return `data["${variable.split("-")[3]}"] = ${variable.replaceAll("-", "_")};\n`
            })
        }

let axiosConfig = {
    method: "${axiosConfig.method}",
    url: "${axiosConfig.url}",
    //headers: req.headers, <-- TODO something with the headers is fudging the request
    httpsAgent: new https.Agent({ rejectUnauthorized: false })${!isEmpty(variables) ? `,\ndata` : ""}
    };

const res = await axios(axiosConfig);
//return (res.data);
return [[ResponseLink]]
} catch (error) {
    return (error);
}; `)

    return script
}


async function response({ allData, variables, params, script }) {
    const responseFunc = "func" + generateRandomString()
    const paramObj = params.reduce((acc, item) => { return { ...acc, ...item } }, {});

    //Build Response Link with function name
    script = script.replace("[[ResponseLink]]", `${responseFunc}(res);`)

    //Build the response function
    script = script.replace("[[Response]]", `\nasync function ${responseFunc}(res){\n`)

    script = script + `
    let params = []

    if(${allData.host.strict_params}){
        switch(res.status.toString()){
            ${Object.keys(paramObj).map((param) => { return `case "${param}": params = ["${(paramObj[param].map(item => Object.keys(item)[0])).join('","')}"];\nbreak;` })}
            default: break;
        }
    }else{
        params = Object.keys(res.data)
    }

    const extractedData = params.reduce((acc, key) => {
        if (res.data.hasOwnProperty(key)) {
            acc[key] = res.data[key];
        }
        return acc;
    }, {});

    [[retLink]]
    
    return returnedObject;
    `;

    script = script + `\n}`

    return script
}

async function return_response({ allData, node, variables, script }) {

    const returnedEdges = allData.builder.edges
        .filter((x) => x.source == allData.masterNodes[2])
        .filter((x) => x.sourceHandle.split("-")[3] != "end")

    const toClientEdges = allData.builder.edges
        .filter((x) => x.target == node.id)
        .filter((x) => x.sourceHandle.split("-")[3] != "end")

    console.log(returnedEdges)
    console.log(toClientEdges)
    //return variable is created "extractedData"
    script = script.replace("[[retLink]]", `
    let returnedObject = {}
    \n[[retLink]]`)


    returnedEdges.map((edge) => {
        script = script.replace("[[retLink]]", `let ${edge.sourceHandle.replaceAll("-", "_")} = extractedData["${edge.sourceHandle.split("-")[3]}"]\n[[retLink]]`)
    })

    toClientEdges.map((edge) => {
        script = script.replace("[[retLink]]", `returnedObject["${edge.targetHandle.split("-")[3]}"] = ${edge.sourceHandle.replaceAll("-", "_")}\n[[retLink]]`)
    })

    //if response -> client node then link through the variables


    //if not link the variables to from their desired nodes

    return script
}


module.exports = {
    build
}

function generateRandomString() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}
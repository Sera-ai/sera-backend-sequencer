// scripts/script.apiNode.js
const https = require("https");
const { fetchNodeData } = require("../helpers/helpers.builder");

async function build({ allData, index, node, variables, params, script }) {
  console.log(index);
  switch (index) {
    case 0:
      return await create({ allData, variables, params, script });
    case 1:
      return await request({ allData, node, variables, script });
    case 2:
      return await response({ allData, variables, params, script });
    case 3:
      return await return_response({ allData, node, variables, script });
  }
}

async function create({ allData, variables, params, script }) {
  const requestFunc = "func" + generateRandomString();

  //begin script with external variables
  script = script + `\n[[Variables]]\n`;

  //create Request function
  script = script + `\nasync function ${requestFunc}(){\n`;

  //set variable
  script = script + `\n[[Link]]\n[[Request]]\n`;

  //Script Starter
  script = script + `\n}\n${requestFunc}()\n`;

  //create Return Function
  script = script + `\n[[Response]]\n`;

  allData.builder.nodes.map(async (node) => {
    console.log(node);
    if (node.type == "functionNode") {
      console.log("cd", node);
      let varname = normalizeVarName(
        "flow_source_" + node.id + "_" + node.data.function
      );
      let inputData =
        node.data.function == "string"
          ? `"${node.data.inputData}"`
          : node.data.inputData;
      let variableDeclaration = `let ${varname} = ${inputData ?? 0}`;
      script = script.replace(
        "[[Variables]]",
        `[[Variables]]\n${variableDeclaration}`
      );
    }
  });

  const varNames = [];

  variables.forEach((variable) => {
    const parts = variable.split("-");
    if (parts.length < 3) return;
    const variableName = normalizeVarName(parts[3]); // Assuming variableName is at the 4th position.
    // Define the sources to check
    const sources = ["body", "query", "path", "cookie", "header"];

    sources.forEach((source) => {
      if (
        allData.req[source] &&
        allData.req[source][variableName] !== undefined
      ) {
        // Variable found in the current source, prepare the declaration
        const value = allData.req[source][variableName];
        const output = typeof value === "string" ? `"${value}"` : value;
        const variableDeclaration = `let ${normalizeVarName(
          variable
        )} = ${output};`;

        // Replace [[Variables]] placeholder with variable declarations in the script, including the new one

        script = script.replace(
          "[[Variables]]",
          `[[Variables]]\n${variableDeclaration}`
        );
      }
    });
  });

  return script;
}

async function request({ allData, node, variables, script }) {
  console.log(allData.req.url);
  let axiosConfig = {
    method: allData.req.method,
    url: "https://" + allData.host.hostname + allData.req.url,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  };

  //Now we have to relink all the changes variables from the builder
  node.edges.map((edge) => {
    if (edge.type == "param") {
      script = script.replace(
        "[[Link]]",
        `[[Link]]\n${edge.targetHandle.replaceAll(
          "-",
          "_"
        )} = ${normalizeVarName(edge.sourceHandle)} ?? null`
      );
    }
  });

  script = script.replace(
    "[[Request]]",
    `\ntry {

    ${
      !isEmpty(variables) &&
      `let data = {${variables
        .filter((x) => x.includes(`flow-target-${node.id}`))
        .map((param) => {
          return `${normalizeVarName(param.split("-")[3])}: ${normalizeVarName(
            param
          )}`;
        })}\}`
    }

        ${
          !isEmpty(variables) &&
          variables
            .filter((variable) => variable.includes("an-extra-variable"))
            .map((variable) => {
              return `data["${normalizeVarName(
                variable.split("-")[3]
              )}"] = ${variable.replaceAll("-", "_")};\n`;
            })
        }

let axiosConfig = {
    method: "${axiosConfig.method}",
    url: "${axiosConfig.url}",
    //headers: req.headers, <-- TODO something with the headers is fudging the request
    httpsAgent: new https.Agent({ rejectUnauthorized: false })${
      !isEmpty(variables) ? `,\ndata` : ""
    }
    };

const res = await axios(axiosConfig);
//return (res.data);
return [[ResponseLink]]
} catch (error) {
    return (error);
}; `
  );

  return script;
}

async function response({ allData, variables, params, script }) {
  const responseFunc = "func" + generateRandomString();
  const paramObj = params.reduce((acc, item) => {
    return { ...acc, ...item };
  }, {});

  //Build Response Link with function name
  script = script.replace("[[ResponseLink]]", `${responseFunc}(res);`);

  //Build the response function
  script = script.replace(
    "[[Response]]",
    `\nasync function ${responseFunc}(res){\n`
  );

  script =
    script +
    `
    let params = []

    if(${allData.config.strict}){
        switch(res.status.toString()){
            ${Object.keys(paramObj).map((param) => {
              return `case "${param}": params = ["${paramObj[param]
                .map((item) => Object.keys(item)[0])
                .join('","')}"];\nbreak;`;
            })}
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

  script = script + `\n}`;

  return script;
}

async function return_response({ allData, node, variables, script }) {
  const returnedEdges = allData.builder.edges
    .filter((x) => x.source == allData.masterNodes[2])
    .filter((x) => !x.sourceHandle.includes("-end"));

  const toClientEdges = allData.builder.edges
    .filter((x) => x.target == node.id)
    .filter((x) => !x.targetHandle.includes("-start"));

  //return variable is created "extractedData"
  script = script.replace(
    "[[retLink]]",
    `
    let returnedObject = {}
    \n[[retLink]]`
  );

  returnedEdges.map((edge) => {
    let itemname = "";
    if (edge.sourceHandle.split("-").length > 4) {
      itemname = `${edge.sourceHandle.split("-")[3]}-${
        edge.sourceHandle.split("-")[4]
      }`;
    } else {
      itemname = edge.sourceHandle.split("-")[3];
    }
    edge.sourceHandle.split("-")[3];
    script = script.replace(
      "[[retLink]]",
      `let ${normalizeVarName(
        edge.sourceHandle
      )} = extractedData["${normalizeVarName(itemname).replace("_", "-")}"]\n[[retLink]]`
    );
  });

  toClientEdges.map((edge) => {
    let itemname = "";
    if (edge.targetHandle.split("-").length > 4) {
      itemname = `${edge.targetHandle.split("-")[3]}-${
        edge.targetHandle.split("-")[4]
      }`;
    } else {
      itemname = edge.targetHandle.split("-")[3];
    }
    script = script.replace(
      "[[retLink]]",
      `returnedObject["${normalizeVarName(itemname).replace("_", "-")}"] = ${normalizeVarName(
        edge.sourceHandle
      )}\n[[retLink]]`
    );
  });

  //if response -> client node then link through the variables

  //if not link the variables to from their desired nodes

  return script;
}

module.exports = {
  build,
};

function generateRandomString() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
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

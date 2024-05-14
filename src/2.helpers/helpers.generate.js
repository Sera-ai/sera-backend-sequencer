const { getApiNodeScript } = require("../scripts/script.apiNode");
const { getScriptNodeScript } = require("../scripts/script.scriptNode");

async function generateRequestScript(
  nodeData,
  RequestFields,
  OasRequestFields,
  edges,
  builderSequence,
  urlData,
  seraHost
) {
  let code = null;
  const { masterNodes, connectedSequences } = builderSequence;
  const requestSequence = connectedSequences.filter(
    (seq) => seq[0] == masterNodes.request[0]
  );
  for (const nodeKey of requestSequence[0]) {
    const node = nodeData[nodeKey];
    const scriptFunc = type2Script(node.type);
    //the script function will handle the nuances that are specific to that node
    const nodeScript = await scriptFunc({
      urlData,
      node,
      RequestFields,
      code,
      edges,
      seraHost,
    });
    code = nodeScript;
  }

  return code;
}

async function generateResponseScript({
  nodeData,
  RequestFields,
  OasRequestFields,
  edges,
  builderSequence,
  urlData,
  seraHost,
  requestScript,
}) {
  let code = null;
  const { masterNodes, connectedSequences } = builderSequence;
  const responseSequence = connectedSequences.filter(
    (seq) => seq[0] == masterNodes.response[0]
  );
  for (const nodeKey of responseSequence[0]) {
    const node = nodeData[nodeKey];
    const scriptFunc = type2Script(node.type);

    //the script function will handle the nuances that are specific to that node
    const nodeScript = await scriptFunc({
      urlData,
      node,
      RequestFields,
      code,
      edges,
      seraHost,
      requestScript,
    });
    code = nodeScript;
  }

  return code;
}

const type2Script = (type) => {
  switch (type) {
    case "apiNode":
      return getApiNodeScript;
    case "scriptNode":
      return getScriptNodeScript;
    default:
      return null;
  }
};

module.exports = {
  generateRequestScript,
  generateResponseScript,
};

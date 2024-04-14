const { getApiNodeScript } = require("../scripts/script.apiNode");

async function generateScripts(nodeData, RequestFields, OasRequestFields, edges) {
  let code = null;

  for (const nodeKey of Object.keys(nodeData)) {
    const node = nodeData[nodeKey];
    const scriptFunc = type2Script(node.type);
    //the script function will handle the nuances that are specific to that node
    const nodeScript = await scriptFunc(node, RequestFields, code, edges);
    code = nodeScript;
  }

  return code;
}

const type2Script = (type) => {
  switch (type) {
    case "apiNode":
      return getApiNodeScript;
    default:
      return null;
  }
};

module.exports = {
  generateScripts,
};

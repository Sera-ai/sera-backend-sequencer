// scripts/script.apiNode.js
const https = require("https");
const { fetchNodeData } = require("../helpers/helpers.builder");

async function build({ allData, index, node, variables, params, script }) {
  return await create({ allData, index, node, variables, params, script });
}

async function create({ allData, index, node, variables, params, script }) {
  console.log(index);
  console.log(node);
  console.log(variables);
  console.log(params);
  console.log(script);
}

module.exports = {
  build,
};

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

const {
  convertType,
  getRequestFields,
  validateRequiredFields,
  toCamelCase,
  edgeConvert,
} = require("./helpers.general");
const { getOasReqFields, getOasResFields } = require("./helpers.oas");
const {
  generateRequestScript,
  generateResponseScript,
} = require("./helpers.generate");

async function scriptBuilder({
  type,
  seraHost,
  seraEndpoint,
  builderSequence,
  requestScript,
  urlData,
  req,
  res,
}) {
  //Step 1 - get all Node Data and pull through OAS params, decided to keep separate due to data augmentation with scripts.
  console.log(res.headersSent);
  const { nodeData } = await getNodeData(seraEndpoint, builderSequence, res);
  const { OasRequestFields, RequestFields } = await enhanceNodeData(
    seraHost,
    req,
    res
  );

  if (res.headersSent) return;

  if (type == "request") {
    //Step 2 - build layered scripts i/o one to another
    const reqScript = await generateRequestScript(
      nodeData,
      RequestFields,
      OasRequestFields,
      seraEndpoint.builder_id.edges,
      builderSequence,
      urlData,
      seraHost
    );
    return reqScript;
  }

  if (type == "response") {
    //Step 2 - build layered scripts i/o one to another
    const responseScript = await generateResponseScript({
      nodeData,
      RequestFields,
      OasRequestFields,
      edges: seraEndpoint.builder_id.edges,
      builderSequence,
      urlData,
      seraHost,
      requestScript,
    });
    return responseScript;
  }

  //Step 3 - Execute script, Flow connected scripts are syncronous, non Flow connected scripts are asyncronous
}

async function getNodeData(seraEndpoint, builderSequence, res) {
  try {
    const nodeData = {};
    const nodeIds = builderSequence.connectedSequences.flat();

    nodeIds.map((nodeid) => {
      const { type, id, data } = seraEndpoint.builder_id.nodes.filter(
        (node) => node.id == nodeid
      )[0];

      const inParams = seraEndpoint.builder_id.edges
        .filter((edge) => edge.target == nodeid)
        .flatMap((edge) => {
          const convertedEdge = edgeConvert(false, edge);
          if (convertedEdge) return [convertedEdge];
          return []; // Return an empty array when there's no match
        });

      const outParams = seraEndpoint.builder_id.edges
        .filter((edge) => edge.source == nodeid)
        .flatMap((edge) => {
          const convertedEdge = edgeConvert(true, edge);
          if (convertedEdge) return [convertedEdge];
          return []; // Return an empty array when there's no match
        });

      nodeData[nodeid] = {
        type,
        id,
        data,
        params: {
          inParams: [...new Set(inParams)],
          outParams: [...new Set(outParams)],
        },
      };
    });

    return { nodeData };
  } catch (e) {
    if (!res.headersSent)
      res.status(500).send({
        "Sera Script Builder Error":
          "Something went wrong in getting initial node data",
      });
  }
}

async function enhanceNodeData(seraHost, req, res) {
  const OasRequestFields = await getOasReqFields(req, seraHost.oas_spec);
  const RequestFields = await getRequestFields(req);
  //const OasResponseFields = await getOasResFields(req, seraHost.oas_spec);

  const hasRequiredFields = validateRequiredFields(
    OasRequestFields.required,
    RequestFields
  );

  if (seraHost.sera_config.strict && !hasRequiredFields)
    res.status(500).send({
      "Sera Validation Error":
        "Required fields not found. Required Fields: " +
        JSON.stringify(OasRequestFields.required),
    });

  return { OasRequestFields, RequestFields };
}

module.exports = {
  scriptBuilder,
};

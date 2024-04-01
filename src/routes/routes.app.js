const axios = require("axios");
const https = require("https");
const vm = require("vm");
const { getBuilderNodes } = require("../helpers/helpers.builder");
const { isEmptyOrNull } = require("../helpers/helpers.general");
const {
  findConnectedSequences,
  beginsWith,
  anyStartsAndEndsWith,
  sequenceBuilder,
} = require("../helpers/helpers.sequence");
const { scriptBuilder } = require("../helpers/helpers.script");

const { learnOas } = require("../helpers/helpers.learning");

const masterSequencer = async (req, res) => {
  //Step 1, get the builder
  //returns { issue: false, oas: oas, endpoint: endpoint, builder: fragileBuilder }
  const allData = await getBuilderNodes(req, res);

  if (!allData.host) {
    //no host no play
    res.status(500).send(allData.issue);
    return;
  }

  const issueCheck = (allData.issue && allData.strict) == true;

  console.log(allData.drift);
  console.log(allData.oasCompliant);
  if (!allData.drift && !allData.oasCompliant[0]) {
    res.status(500).send("Request is not OAS compliant");
    return;
  }

  if (issueCheck) {
    res.status(500).send(allData.issue);
    return;
  }

  if (allData.issue && !allData.strict) {
    const learnUrl = `${`https://`}${allData.host.hostname}${
      allData.requestData.path
    }`;
    console.log(learnUrl);
    try {
      let axiosConfig = {
        method: req.method,
        url: learnUrl,
        //headers: req.headers, <-- TODO something with the headers is fudging the request
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      };

      isEmptyOrNull(req.body) ? null : (axiosConfig["data"] = req.body);

      const response = await axios(axiosConfig);
      res.status(response.status).send(response.data);

      if (allData.host.sera_config.learn) {
        learnOas({ allData, response, req });
      }
    } catch (error) {
      console.log(error);
      res.status(500).send({
        seraError: allData.issue,
        seraMessage:
          "You are seeing this because your host is not set to Strict and this API call requst failed",
        error: error,
      });
    }
    return;
  }

  //first get node IDs for 0-3, match request and response

  const masterNodes = allData.builder.nodes
    .filter(
      (node) =>
        node.type === "apiNode" &&
        (node.className.includes("Request") ||
          node.className.includes("Server") ||
          node.className.includes("Response") ||
          node.className.includes("Client"))
    )
    .sort((a, b) => {
      const order = ["Request", "Server", "Response", "Client"];
      const aIndex = order.findIndex((className) =>
        a.className.includes(className)
      );
      const bIndex = order.findIndex((className) =>
        b.className.includes(className)
      );
      return aIndex - bIndex;
    })
    .map((node) => node.id);

  //build flow

  allData["masterNodes"] = masterNodes;

  const filteredEdges = allData.builder.edges
    .filter(
      (edge) =>
        edge.sourceHandle.includes("end") && edge.targetHandle.includes("start")
    )
    .map((edge) => edge);
  const connectedSequences = findConnectedSequences(
    allData.builder.nodes,
    filteredEdges
  );

  if (beginsWith(connectedSequences, masterNodes[0]) == -1) {
    res.status(500).send("There is no connected entry point");
    return;
  }

  if (
    anyStartsAndEndsWith(connectedSequences, masterNodes[0], masterNodes[1]) ==
    -1
  ) {
    console.log("Broken Node Sequence Request");
  }
  if (
    anyStartsAndEndsWith(connectedSequences, masterNodes[2], masterNodes[3]) ==
    -1
  ) {
    res.status(500).send("Broken Node Sequence Response");
  }

  //build file to execute

  try {
    const requestScript = await scriptBuilder({
      req,
      allData,
      connectedSequences,
    });

    console.log("last",requestScript);
    const script = new vm.Script(requestScript);
    const context = new vm.createContext({
      axios: axios,
      https: https,
    });
    const result = await script.runInContext(context);

    console.log("result", result);

    if (!res.headersSent) res.send(result);
  } catch (e) {
    if (!res.headersSent) res.send(e);
  }

  //send request
  //build file for response
  //res data

  //Step 2, Map the nodes
  //Step 3, Build the template for executing the code
  //Step 4, Execute the code
  //Step 5, Send execution notice to the websocket
};

module.exports = {
  masterSequencer,
};

const axios = require("axios");
const https = require("https");
const vm = require("vm");
const { getBuilderNodes } = require("../helpers/helpers.builder");
const { isEmptyOrNull } = require("../helpers/helpers.general");
const redis = require("../services/services.redis");
const {
  findConnectedSequences,
  beginsWith,
  anyStartsAndEndsWith,
  sequenceBuilder,
} = require("../helpers/helpers.sequence");
const { scriptBuilder } = require("../helpers/helpers.script");
const {
  updateRequestMetrics,
  decideCacheTTL,
} = require("../helpers/helpers.redis");

const masterSequencer = async (req, res) => {
  //Step 1, get the builder
  //returns { issue: false, oas: oas, endpoint: endpoint, builder: fragileBuilder }
  const allData = await getBuilderNodes(req, res);
  const isFalse = (allData.issue && allData.strict) == true;

  if (isFalse) {
    res.status(500).send(allData.issue);
    return;
  }

  if (allData.issue && !allData.strict) {
    console.log(allData.requestData.url);

    // Caching check
    const { host, path, method } = req;
    const cacheKey = `cache:${generateRequestKey(host, path, method)}`;

    // Attempt to get a cached response
    const cachedResponse = await redis.get(cacheKey);
    if (cachedResponse) {
      console.log(`Serving from cache: ${cacheKey}`);
      res.status(200).send(JSON.parse(cachedResponse));
      return; // End execution as cached response has been sent
    }

    // If no cached response, continue with axios call
    try {
      // ... set up axiosConfig ...
      const response = await axios(axiosConfig);

      // Process and cache the response
      const responseData = response.data;
      const metrics = await updateRequestMetrics(
        host,
        path,
        method,
        responseData
      );
      const ttl = decideCacheTTL(metrics);

      if (ttl > 0) {
        await redis.set(cacheKey, JSON.stringify(responseData), "EX", ttl);
        console.log(`Caching response with TTL of ${ttl} seconds`);
      }

      // Send the actual response back to the client
      res.status(response.status).send(responseData);
    } catch (error) {
      // ... error handling ...
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

    console.log(requestScript);
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

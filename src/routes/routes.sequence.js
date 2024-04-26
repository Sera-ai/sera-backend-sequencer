const axios = require("axios");
const https = require("https");
const vm = require("vm");
const { stringifyError } = require("../helpers/helpers.general");
const { builderFlow } = require("../helpers/helpers.sequence");
const { scriptBuilder } = require("../helpers/helpers.script");
const {
  fetchDNSHostAndEndpointDetails,
} = require("../helpers/helpers.database");
const { validateOas } = require("../helpers/helpers.oas");
const { checkStrictAndLearn } = require("../helpers/helpers.checks");

const sequencer = async (req, res) => {
  //Step 1 - Get the request datbase entries
  const { protocol, hostname, path, method } = req;
  const urlData = {
    protocol,
    hostname,
    path,
    method,
    url: `${protocol}://${hostname}${path}`,
  };
  const { seraDNS, seraHost, seraEndpoint } =
    await fetchDNSHostAndEndpointDetails(urlData);

  //Step 2 - Check validity of entry compared to request
  if (!res.headersSent && !seraDNS._id)
    res.status(500).send({ "Sera DNS Error": seraDNS.error });
  if (!res.headersSent && !seraHost._id)
    res.status(500).send({ "Sera Host Error": seraHost.error });

  const OasCompliance = validateOas(seraHost.oas_spec, urlData, req);

  if (!res.headersSent)
    if (!seraHost?.sera_config?.drift && !OasCompliance.compliant)
      res.status(500).send(OasCompliance.issues.join(", "));

  const FlexibleCheck =
    !res.headersSent &&
    (await checkStrictAndLearn({
      seraHost,
      seraEndpoint,
      OasCompliance,
      urlData,
      req,
      res,
    }));

  const Stage2Check = () => {
    return !(res.headersSent && FlexibleCheck);
  };

  //Step 3 - Get the node sequence and prepare for script building
  const builderSequence = Stage2Check() && builderFlow(seraEndpoint, res);

  //Step 4 - Begin Iterating and Building Script

  const reqScriptResult =
    Stage2Check() &&
    seraEndpoint.builder_id &&
    (await scriptBuilder({
      type: "request",
      seraHost,
      seraEndpoint,
      builderSequence,
      requestScript: null,
      urlData,
      req,
      res,
    }));

  console.log(reqScriptResult);

  //Step 5 - Execute Script and get response
  let reqResult = null;
  try {
    if (reqScriptResult) {
      const script = new vm.Script(reqScriptResult);
      const context = new vm.createContext({
        axios: axios,
        https: https,
      });
      const result = await script.runInContext(context);

      console.log("result", result);

      reqResult = result;
    }
  } catch (e) {
    console.log(e);
    if (!res.headersSent) res.send(e);
  }

  //Step 6 - do checks and balances agains return data

  

  const resScriptResult =
  Stage2Check() &&
  seraEndpoint.builder_id &&
  (await scriptBuilder({
    type: "response",
    seraHost,
    seraEndpoint,
    builderSequence,
    requestScript: reqScriptResult,
    urlData,
    req,
    res,
  }));

  try {
    if (resScriptResult) {
      // const script = new vm.Script(resScriptResult);
      // const context = new vm.createContext({
      //   axios: axios,
      //   https: https,
      // });
      // const result = await script.runInContext(context);

      // console.log("result", result);
      //console.log(resScriptResult)
      //if (!res.headersSent) res.send(result.data);
    }
  } catch (e) {
    console.log(e);
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
  sequencer,
};

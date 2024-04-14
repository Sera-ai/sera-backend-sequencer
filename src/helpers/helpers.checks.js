const { isEmptyOrNull } = require("./helpers.general");
const { learnOas } = require("./helpers.learning");
const https = require("https");
const axios = require("axios");

async function checkStrictAndLearn({
  seraHost,
  OasCompliance,
  seraEndpoint,
  urlData,
  req,
  res,
}) {
  const learnUrl = `${`https://`}${seraHost?.hostname}${urlData.path}`;
  if (!seraHost?.sera_config?.strict && !seraEndpoint?._id) {
    if (!res.headersSent) {
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

        if (seraHost?.sera_config?.learn) {
          learnOas({ seraHost, urlData, response, req });
          return false;
        }
      } catch (error) {
        console.log(error);
        res.status(500).send({
          seraError: OasCompliance.issues.join(","),
          seraMessage:
            "You are seeing this because your host is not set to Strict and this API call requst failed",
          statusCode: error.message,
        });
        return false;
      }
    } else {
      return false;
    }
  } else {
    return true;
  }
}

module.exports = {
  checkStrictAndLearn,
};

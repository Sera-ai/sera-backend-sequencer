const SwaggerParser = require("@apidevtools/swagger-parser");
const Hosts = require("../models/models.hosts");
const Endpoints = require("../models/models.endpoints");
const seraDNS = require("../models/models.dns");

async function fetchDNSHostAndEndpointDetails(urlData) {

  const seraHost = await getHost(urlData.hostname);

  return {
    seraHost
  };
}

async function getHost(hostname) {
  let host = {};
  try {
    if (hostname) {
      host = await Hosts.findOne({ hostname: hostname }).populate(["oas_spec"]);
      const rawOas = host.toObject().oas_spec;
      const oas_id = rawOas._id
      delete rawOas._id;
      delete rawOas.__v;

      let parsedOas
      try {
        parsedOas = await SwaggerParser.validate(rawOas);
      } catch (e) {
        throw e.details
      }
      return {
        ...host.toObject(),
        oas_spec: host.toObject().oas_spec,
        parsedOas,
        oas_id,
        result: true,
        error: null,
      };
    } else {
      throw "No hostname provided";
    }
  } catch (e) {
    console.log("Caught", e);
    return { ...host, result: false, error: "Host does not exist" };
  }
}

module.exports = {
  fetchDNSHostAndEndpointDetails,
};

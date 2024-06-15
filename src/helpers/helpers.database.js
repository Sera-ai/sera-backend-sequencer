const SwaggerParser = require("@apidevtools/swagger-parser");
const Hosts = require("../models/models.hosts");
const Endpoints = require("../models/models.endpoints");
const seraDNS = require("../models/models.dns");

async function fetchDNSHostAndEndpointDetails(urlData) {

  const { hostname } = urlData;
  let host = {};
  host = await Hosts.findOne({ hostname: hostname }).populate(["oas_spec"]);

  if (!host) {
    console.log(host)
    return {
      success: false,
      error: "Host does not exist",
    };
  }
  const rawOas = host.toObject().oas_spec;
  if (!rawOas._id) return { success: false, error: `No OAS Spec: ${host}` }

  const oas_id = rawOas._id
  delete rawOas._id;
  delete rawOas.__v;
  
  console.log(rawOas)

  let parsedOas
  try {
    parsedOas = rawOas;
    return {
      ...host.toObject(),
      oas_spec: host.toObject().oas_spec,
      parsedOas,
      oas_id,
      success: true,
      error: null,
    };
  } catch (e) {
    return { success: false, error: e }
  }

}


module.exports = {
  fetchDNSHostAndEndpointDetails,
};

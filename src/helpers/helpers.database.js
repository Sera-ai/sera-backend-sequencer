const SwaggerParser = require("@apidevtools/swagger-parser");
const Hosts = require("../models/models.hosts");
const Endpoints = require("../models/models.endpoints");
const seraDNS = require("../models/models.dns");

async function fetchDNSHostAndEndpointDetails(urlData) {
  const seraDNS = await getDNS(urlData);
  const seraHost = await getHost(seraDNS);
  const seraEndpoint = await getEndpoint(seraHost, urlData);

  return {
    seraDNS,
    seraHost,
    seraEndpoint,
  };
}

async function getDNS(urlData) {
  let dns = {};
  let error = null;
  try {
    const regdns = await seraDNS.findOne({
      "sera_config.sub_domain": urlData.hostname.split(".")[0],
    });
    if (!regdns) {
      const obdns = await seraDNS.findOne({
        "sera_config.obfuscated": urlData.hostname,
      });

      if (!obdns) {
        error = "No DNS Settings";
      }

      dns = obdns;
    } else {
      dns = regdns;
    }
    return { ...dns.toObject(), error };
  } catch (e) {
    return { ...dns, error: "DNS does not exist" };
  }
}

async function getHost(data) {
  let host = {};
  try {
    if (data?._id) {
      host = await Hosts.findOne({ sera_dns: data._id }).populate(["oas_spec"]);
      const rawOas = host.toObject().oas_spec;
      const oas_id = rawOas._id
      delete rawOas._id;

      const parsedOas = await SwaggerParser.validate(rawOas);
      return {
        ...host.toObject(),
        oas_spec: parsedOas,
        oas_id,
        error: null,
      };
    } else {
      throw "No DNS provided";
    }
  } catch (e) {
    console.log("Caught", e);
    return { ...host, oas_id: null, error: "Host does not exist" };
  }
}

async function getEndpoint(data, urlData) {
  let endpoint = null;
  try {
    endpoint = await Endpoints.findOne({
      host_id: data._id,
      endpoint: urlData.path,
      method: urlData.method,
    }).populate({
      path: "builder_id",
      populate: [{ path: "nodes" }, { path: "edges" }],
    });
    return { ...endpoint.toObject(), error: null };
  } catch (e) {
    return { ...endpoint, error: "Endpoint does not exist" };
  }
}

module.exports = {
  fetchDNSHostAndEndpointDetails,
};

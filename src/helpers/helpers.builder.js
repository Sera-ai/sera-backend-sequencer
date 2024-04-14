const Hosts = require("../models/models.hosts");
const Endpoints = require("../models/models.endpoints");
const Plugins = require("../models/models.plugins");
const OAS = require("../models/models.oas");
const seraDNS = require("../models/models.dns");
const Builder = require("../models/models.builder");
const Nodes = require("../models/models.nodes");
const Edges = require("../models/models.edges");
const { getDataFromPath } = require("./helpers.general");

const getPathways = (path) => {
  return path
    .split("/")
    .slice(1)
    .map((segment, index, arr) =>
      index === arr.length - 1 ? segment : "/" + segment
    );
};

const getRefData = (ref, oas) => {
  return getDataFromPath(ref.split("/").slice(1), oas).properties;
};

const getFieldsForNode = async (nodeData, method, pathwayData, oas) => {
  let fields = { in: [], out: [] };

  if (method !== "POST" || !pathwayData) {
    if ([2, 4].includes(nodeData.headerType)) {
      fields["in"] = [];
    }

    if ([1, 3].includes(nodeData.headerType)) {
      fields["out"] = [];
    }
    return fields;
  }

  if ([2, 4].includes(nodeData.headerType)) {
    fields["in"] = getRefData(
      pathwayData.requestBody.content[
        Object.keys(pathwayData.requestBody.content)[0]
      ].schema.$ref,
      oas
    );
  }

  if ([1, 3].includes(nodeData.headerType)) {
    fields["out"] = getRefData(
      pathwayData.responses["201"].content[
        Object.keys(pathwayData.responses["201"].content)[0]
      ].schema.$ref,
      oas
    );
    (fields["out"]["__header"] ??= {})["status"] = "201";
  }

  return fields;
};

const fetchNodeData = async (node) => {
  if (!node.id) return null;
  return (await Nodes.findById(node.id)).toObject();
};

async function getBuilderNodes(req, res) {
  let { protocol, hostname, path, method } = req;
  let url = `${protocol}://${hostname}${path}`;

  let strict = true;
  let temphost = null;
  let drift = false;
  let oasCompliant = [false, "OAS has not been checked"];
  console.log(url);

  try {
    let dns;
    const regdns = await seraDNS.findOne({
      "sera_config.sub_domain": hostname.split(".")[0],
    });
    if (!regdns) {
      const obdns = await seraDNS.findOne({
        "sera_config.obfuscated": hostname,
      });
      dns = obdns;
    } else {
      dns = regdns;
    }
    if (!dns) throw { error: "no dns" };

    const host = await Hosts.findOne({ sera_dns: dns._id }).populate([
      "oas_spec",
    ]);

    strict = host.sera_config.strict;
    drift = host.sera_config?.drift || false;

    if (!host) throw { error: "NoHost" };
    temphost = host;
    const oas = host.oas_spec;
    console.log(path);
    console.log(method);

    if (
      oas &&
      oas.paths &&
      oas.paths[path] &&
      oas.paths[path][method.toLowerCase()]
    ) {
      const operation = oas.paths[path][method.toLowerCase()];

      // Validate query parameters
      if (operation.parameters) {
        for (const parameter of operation.parameters) {
          if (parameter.required) {
            if (parameter.in === "query" && !req.query[parameter.name]) {
              oasCompliant = [
                false,
                `Missing required query parameter: ${parameter.name}`,
              ];
            }
            if (
              parameter.in === "header" &&
              !req.headers[parameter.name.toLowerCase()]
            ) {
              oasCompliant = [
                false,
                `Missing required header: ${parameter.name}`,
              ];
            }
            if (parameter.in === "path" && !req.params[parameter.name]) {
              // Assuming you're using express' route parameters feature
              oasCompliant = [
                false,
                `Missing required path parameter: ${parameter.name}`,
              ];
            }
            // 'cookie' parameter validation could be added here if cookies are used
          }
        }
      }

      // Validate request body if applicable
      if (operation.requestBody && operation.requestBody.required) {
        const content = operation.requestBody.content;
        if (content) {
          const contentType = req.headers["content-type"];
          if (content[contentType]) {
            const schema = content[contentType].schema;
            // Simplified validation: check if the body is empty for required requestBody
            // Real validation should compare against the `schema`
            if (Object.keys(req.body).length === 0) {
              oasCompliant = [false, "Missing required request body"];
            }
            // Schema validation logic should be implemented here
            // For example, checking if all required properties are present in the request body
          } else {
            oasCompliant = [false, "Unsupported Content-Type"];
          }
        }
      }

      oasCompliant = [true, ""];
    }

    const endpoint = await Endpoints.findOne({
      host_id: host._id,
      endpoint: path,
      method: method,
    }).populate({
      path: "builder_id",
      populate: [{ path: "nodes" }, { path: "edges" }],
    });

    if (!endpoint) throw { error: "NoEndpoint", host: host._id };

    return {
      issue: false,
      oas: oas.toObject(),
      endpoint: endpoint,
      builder: endpoint.builder_id,
      host: host.toObject(),
      strict,
      drift,
      oasCompliant,
      config: host.sera_config,
      requestData: { url, hostname: host.hostname, method, path },
      req,
    };
  } catch (error) {
    return {
      issue: error,
      strict,
      drift,
      host: temphost.toObject(),
      requestData: { url, method, path },
      oasCompliant,
      req,
    };
  }
}

module.exports = {
  getBuilderNodes,
  fetchNodeData,
};

const { getDataFromPath } = require("./helpers.general");

const validateOas = (oas, urlData, req) => {
  const { path, method } = urlData;
  let oasCompliant = {
    compliant: true,
    issues: [],
  };

  try {
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
              oasCompliant.compliant = false;
              oasCompliant.issues.push(
                `Missing required query parameter: ${parameter.name}`
              );
            }
            if (
              parameter.in === "header" &&
              !req.headers[parameter.name.toLowerCase()]
            ) {
              oasCompliant.compliant = false;
              oasCompliant.issues.push(
                `Missing required header: ${parameter.name}`
              );
            }
            if (parameter.in === "path" && !req.params[parameter.name]) {
              oasCompliant.compliant = false;
              oasCompliant.issues.push(
                `Missing required path parameter: ${parameter.name}`
              );
            }
            // 'cookie' parameter validation could be added here similarly if cookies are used
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
              oasCompliant.compliant = false;
              oasCompliant.issues.push("Missing required request body");
            }
            // Schema validation logic should be implemented here
            // For example, checking if all required properties are present in the request body
          } else {
            oasCompliant.compliant = false;
            oasCompliant.issues.push("Unsupported Content-Type");
          }
        }
      }

      return oasCompliant;
    } else {
      return { compliant: false, issues: ["No OAS"] };
    }
  } catch (e) {
    return { compliant: false, issues: [e] };
  }
};

async function getOasReqFields(req, oas) {
  const { protocol, hostname, path, method } = req;
  try {
    const url = `${protocol}://${hostname}${path}/${method.toLowerCase()}`;
    const parsed = new URL(url);
    const splitPath = parsed.pathname.split("/").slice(1);
    const oasPathways = splitPath.map((path, index) => {
      return index === splitPath.length - 1 ? path : "/" + path;
    });
    const pathwayData = getDataFromPath(oasPathways, oas.paths);

    if (pathwayData) {
      const fields = { header: [], cookie: [], body: [], path: [], query: [] };
      const requiredf = {
        header: [],
        cookie: [],
        body: [],
        path: [],
        query: [],
      };
      const { parameters, requestBody } = pathwayData;

      if (parameters && parameters.length > 0) {
        parameters.map((paramObj) => {
          const { name, schema } = paramObj;
          fields[paramObj.in].push({
            name: name.toLowerCase(),
            type: schema?.type,
          });
          if (paramObj?.required)
            requiredf[paramObj.in].push(paramObj.name.toLowerCase());
        });
      }

      if (requestBody) {
        const schema = requestBody?.content["application/json"]?.schema;
        const schemaDetails = extractSchemaDetails(schema);

        schemaDetails.map((param) => {
          const { name, type, required } = param;
          fields["body"].push({ name: name.toLowerCase(), type });
          if (required) requiredf["body"].push(name.toLowerCase());
        });
      }

      //go through and grab all param field names, types, required, and locations

      return { required: requiredf, fields };
    } else {
      return { required: {}, fields: {} };
    }
  } catch (e) {
    console.log(e);
  }
}

async function getOasResFields(req, oas) {
  try {
    const url =
      req.protocol +
      "://" +
      req.hostname +
      req.path +
      "/" +
      req.method.toLowerCase();
    const parsed = new URL(url);
    const splitPath = parsed.pathname.split("/").slice(1);
    const oasPathways = splitPath.map((path, index) => {
      return index === splitPath.length - 1 ? path : "/" + path;
    });
    const pathwayData = getDataFromPath(oasPathways, oas.paths);
    const lastSlashIndex = parsed.pathname.lastIndexOf("/");
    const method = parsed.pathname.substring(lastSlashIndex + 1).toUpperCase();

    if (pathwayData && pathwayData.responses) {
      const responsesData = Object.entries(pathwayData.responses)
        .map(([statusCode, responseData]) => {
          if (responseData.content) {
            const refId =
              responseData.content[Object.keys(responseData.content)[0]].schema
                .$ref;
            console.log(responseData.content);
            if (refId) {
              const parsedRefId = refId.split("/").slice(1);
              const refData = getDataFromPath(parsedRefId, oas);

              return {
                [statusCode]: Object.keys(refData.properties).map((field) => ({
                  [field]: {
                    ...refData.properties[field],
                    required: refData.required
                      ? refData.required.includes(field)
                      : false,
                  },
                })),
              };
            } else if (
              responseData.content[Object.keys(responseData.content)[0]]?.schema
            ) {
              const inlineProperties =
                responseData.content[Object.keys(responseData.content)[0]]
                  ?.schema?.properties;
              if (inlineProperties)
                return {
                  [statusCode]: Object.keys(inlineProperties).map((field) => ({
                    [field]: {
                      ...inlineProperties[field],
                      required: false,
                    },
                  })),
                };
            }
          }
          return null;
        })
        .filter((response) => response !== null); // Remove any null responses

      return [responsesData, method];
    } else {
      return [null, method];
    }
  } catch (e) {
    console.log(e);
  }
}

function doesRefExist(obj) {
  if (obj !== null && typeof obj === "object") {
    // Ensure obj is an object
    for (const key of Object.keys(obj)) {
      if (key === "$ref") return obj[key]; // Return the value associated with $ref
      // If the value is an object, recursively search it
      if (typeof obj[key] === "object") {
        const found = findRefValue(obj[key]);
        if (found !== undefined) return found; // If $ref is found in a nested object, return its value
      }
    }
  }
  return false; // $ref not found
}

function extractSchemaDetails(schema) {
  const properties = schema.properties || {}; // Get the properties object from the schema
  const requiredProperties = new Set(schema.required || []); // Convert required array to a Set for easy lookup

  // Transform the properties object into an array of details
  const details = Object.keys(properties).map((propertyName) => {
    return {
      name: propertyName,
      type: properties[propertyName].type,
      required: requiredProperties.has(propertyName), // Check if the property is marked as required
    };
  });

  return details;
}

module.exports = {
  validateOas,
  getOasReqFields,
  getOasResFields,
};

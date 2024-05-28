const OAS = require("../models/models.oas");


const learnOas = async ({ seraHost, urlData, response, req }) => {
  let existingOas = seraHost.oas_spec;
  let path = urlData.path;

  if (!existingOas.paths) {
    existingOas.paths = {};
  }

  // Ensure the path exists in the OAS document
  if (!existingOas.paths[path]) {
    existingOas.paths[path] = {};
  }

  function getType(value) {
    if (Array.isArray(value)) return "array";
    if (value === null) return "null"; // Note: OAS does not directly support 'null'. This needs special handling.
    return typeof value;
  }

  // Helper function to generate schema from data
  function generateSchemaFromData(data) {
    if (Array.isArray(data)) {
      let itemsType = data.length > 0 ? generateSchemaFromData(data[0]) : {};
      return { type: "array", items: itemsType };
    } else if (typeof data === "object" && data !== null) {
      let properties = {};
      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined) {
          // Check to ensure the property is not undefined
          properties[key] = generateSchemaFromData(data[key]);
        }
      });
      return { type: "object", properties: properties };
    } else {
      return { type: typeof data };
    }
  }

  const deepMerge = (target, source) => {
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        Object.assign(source[key], deepMerge(target[key], source[key]));
      }
    }
    Object.assign(target || {}, source);
    return target;
  };
  
  let parameters = [];

  // Add query parameters, if present
  if (req?.query && Object.keys(req?.query).length) {
    Object.keys(req.query).forEach((key) => {
      parameters.push({
        name: key,
        in: "query",
        required: false, // Adjust based on actual requirement
        schema: {
          type: getType(req.query[key]),
        },
      });
    });
  }

  // Add path parameters, if present
  if (req?.params && Object.keys(req?.params).length) {
    Object.keys(req.params).forEach((key) => {
      parameters.push({
        name: key,
        in: "path",
        required: false, // Adjust based on actual requirement
        schema: {
          type: getType(req.params[key]),
        },
      });
    });
  }

  // Check for response and req.body before attempting to use them
  let responseSchema =
    response ? generateSchemaFromData(response) : null;
  let requestBodySchema =
    req.body && Object.keys(req.body).length !== 0
      ? generateSchemaFromData(req.body)
      : null;

  // Prepare the new operation object
  let newOperation = {
    summary: `Auto-generated path for ${path}`,
    description: `Automatically generated operation for method ${urlData.method}`,
    parameters: parameters,
    responses: responseSchema
      ? {
        [response.status]: {
          description: `Example response for ${path}`,
          content: {
            "application/json": {
              schema: responseSchema,
            },
          },
        },
      }
      : {},
  };

  // Conditionally add requestBody to the operation if it's present and not empty
  if (requestBodySchema) {
    newOperation.requestBody = {
      content: {
        "application/json": {
          schema: requestBodySchema,
        },
      }
    };
  }

  // Check if the path already exists
  if (!existingOas.paths[path]) {
    existingOas.paths[path] = {};
  }

  // Check if the method already exists
  if (existingOas.paths[path][urlData.method.toLowerCase()]) {
    // Merge parameters
    let existingParameters =
      existingOas.paths[path][urlData.method.toLowerCase()].parameters || [];
    newOperation.parameters = [...existingParameters, ...newOperation.parameters];

    // Merge responses
    let existingResponses =
      existingOas.paths[path][urlData.method.toLowerCase()].responses || {};
    newOperation.responses = { ...existingResponses, ...newOperation.responses };

    // Merge requestBody if it exists in both
    if (existingOas.paths[path][urlData.method.toLowerCase()].requestBody && newOperation.requestBody) {
      let existingRequestBody =
        existingOas.paths[path][urlData.method.toLowerCase()].requestBody.content["application/json"].schema;
      newOperation.requestBody.content["application/json"].schema = deepMerge(
        existingRequestBody,
        newOperation.requestBody.content["application/json"].schema
      );
    }
  }

  console.log(newOperation);
  // Add or update the operation
  existingOas.paths[path][urlData.method.toLowerCase()] = newOperation;


  // Example usage  

  try {
    if (!seraHost?.oas_spec?._id || !existingOas) {
      throw new Error("Missing OAS document ID or update data.");
    }

    const updatedDocument = await OAS.findByIdAndUpdate(
      seraHost.oas_spec._id,
      { $set: existingOas }, // Use $set to explicitly specify the fields to update
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (updatedDocument) {
      console.log("OAS document updated successfully:", updatedDocument);
    } else {
      console.log("OAS document not found with ID:", seraHost.oas_spec._id);
    }
  } catch (error) {
    console.error("Error updating OAS document:", error);
  }
};

module.exports = {
  learnOas,
};

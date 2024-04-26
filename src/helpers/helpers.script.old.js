const scripts = require("../scripts");
const {
  getOasFields,
  getReqFields,
  getOasResFields,
} = require("./helpers.general");
const { sequenceBuilder } = require("./helpers.sequence");

async function scriptBuilder({ req, allData, connectedSequences }) {
  const masterNodes = allData.masterNodes;

  //Make sure I have All parameters according to OAS (expected parameters)
  //Make sure I have ALL parameters actually sent (unexpected parameters)
  //If send_strict is true - trim all data but the OAS defined items
  //Create list of all parameters based on above (strict = expected, not strict = expected+unexpected)

  try {
    const reqParams = await grabReqParameters(allData, req);

    console.log(reqParams)
    const reqSequence =
      connectedSequences[
        findSequenceIndex(masterNodes[0], masterNodes[1], connectedSequences)
      ];

    const reqSequenceNodes = reqSequence.flatMap((nodeid) => {
      let node = allData.builder.nodes.find((n) => n.id == nodeid);
      if (!node) return []; // If node is not found, return an empty array
      // Copy the node object to avoid modifying the original object
      node = { ...node };
      node.edges = {
        in: allData.builder.edges
          .filter((edge) => edge.source == nodeid)
          .filter((edge) => !edge.sourceHandle.includes("sera_end")),
        out: allData.builder.edges
          .filter((edge) => edge.target == nodeid)
          .filter((edge) => !edge.targetHandle.includes("sera_start")),
      };


      return [node]; // Return node inside an array to match the expected structure for flatMap
    });


    //Need to iterate through the map above and match edges to gian full input output perspective

    //This is the input -> SERA -> Output variables.
    const reqVariables = sequenceBuilder(req, reqSequence, allData.builder);

    const resParams = await grabResParameters(allData, req);
    const resSequence =
      connectedSequences[
        findSequenceIndex(masterNodes[2], masterNodes[3], connectedSequences)
      ];
    const resVariables = sequenceBuilder(req, resSequence, allData.builder);

    console.log(reqSequence)

    let script = "";

    for (const seq of reqSequence) {
      const nodeIndex = allData.builder.nodes.findIndex(
        (array) => array.id === seq
      );
      let node = allData.builder.nodes[nodeIndex];

      node.edges = allData.builder.edges.filter((edge) =>
        edge.target.includes(seq)
      );

      const scriptJS = await scripts[node.type];
      const index = masterNodes.findIndex((array) => array === node.id);
      script = await scriptJS.build({
        allData,
        index: index,
        node,
        variables: reqVariables,
        params: reqParams,
        script,
      });
    }

    for (const seq of resSequence) {
      const nodeIndex = allData.builder.nodes.findIndex(
        (array) => array.id === seq
      );
      let node = allData.builder.nodes[nodeIndex];

      node.edges = allData.builder.edges.filter((edge) =>
        edge.target.includes(seq)
      );

      const scriptJS = await scripts[node.type];
      const index = masterNodes.findIndex((array) => array === node.id);

      script = await scriptJS.build({
        allData,
        index: index,
        node,
        variables: resVariables,
        params: resParams,
        script,
      });
    }

    //sanitize
    script = script.replaceAll("[[Variables]]", "");
    script = script.replaceAll("[[Response]]", "");
    script = script.replaceAll("[[Link]]", "");
    script = script.replaceAll("[[Request]]", "");
    script = script.replaceAll("[[retLink]]", "");

    return await script;
  } catch (e) {
    throw e;
  }
}

async function grabReqParameters(allData, req) {
  if (req.method === "GET") return [];
  const fields = await getOasFields(req, allData.oas);
  const unexpectedParams = getReqFields(req);
  if (!allData.host.strict_params) {
    return mergeArrays(fields[0], unexpectedParams);
  }

  const { containsParams, typeMatched, parsedParams } = matchTypesAndExtract(
    fields[0],
    unexpectedParams
  );
  if (containsParams && typeMatched) {
    return parsedParams;
  } else {
    throw `Request parameters does not match OAS spec, strict set to ${allData.strict}`;
  }
}

async function grabResParameters(allData, req) {
  const fields = await getOasResFields(req, allData.oas);
  return fields[0];
}

module.exports = {
  scriptBuilder,
  grabReqParameters,
  findSequenceIndex,
};

const typeMatch = (type1, type2) => {
  if (
    (type1 === "integer" && type2 === "number") ||
    (type1 === "number" && type2 === "integer")
  ) {
    return true;
  }
  return type1 === type2;
};

const matchTypesAndExtract = (arr1, arr2) => {
  const flattenedArr1 = Object.assign({}, ...arr1);
  const flattenedArr2 = Object.assign({}, ...arr2);
  const parsedParams = [];
  let containsParams = true;
  let typeMatched = true;

  for (const key in flattenedArr1) {
    if (flattenedArr1[key].required === true && !(key in flattenedArr2)) {
      containsParams = false;
    }
    if (key in flattenedArr2) {
      if (!typeMatch(flattenedArr1[key].type, flattenedArr2[key])) {
        typeMatched = false;
      }
      parsedParams.push({ [key]: flattenedArr2[key] });
    }
  }

  return { containsParams, typeMatched, parsedParams };
};

const mergeArrays = (arr1, arr2) => {
  const mergedArray = [];
  const arrayKeys = [];

  arr2.map((paramObj) => {
    const param = Object.keys(paramObj)[0];
    if (!arrayKeys.includes(param)) {
      arrayKeys.push(param);
      mergedArray.push({ [param]: paramObj[param] });
    }
  });

  arr1.map((paramObj) => {
    const param = Object.keys(paramObj)[0];
    if (!arrayKeys.includes(param)) {
      arrayKeys.push(param);
      mergedArray.push({ [param]: paramObj[param] });
    }
  });

  return mergedArray;
};

function findSequenceIndex(start, end, arrayOfArrays) {
  for (let i = 0; i < arrayOfArrays.length; i++) {
    const subArray = arrayOfArrays[i];
    if (subArray[0] === start && subArray[subArray.length - 1] === end) {
      return i;
    }
  }
  return -1; // or another value to indicate no match
}

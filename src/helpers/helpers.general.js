function calculateElapsedTime(start, end) {
  return (
    (end[0] * 1000 + end[1] / 1e6 - (start[0] * 1000 + start[1] / 1e6)).toFixed(
      2
    ) + "ms"
  );
}

function getDataFromPath(arr, obj) {
  let currentObj = obj;
  for (let i = 0; i < arr.length; i++) {
    const key = arr[i];
    if (key in currentObj) {
      currentObj = currentObj[key];
    } else {
      return null; // key not found in object
    }
  }
  return currentObj; // Return the data from the last key in the array
}

function generateRandomString() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}

function getReqFields(req) {
  const fields = ["body", "headers", "cookies", "param"];
  return fields.map((fieldType) => {
    return Object.entries(req[fieldType]).map(([key, value]) => {
      return {
        [key]: typeof value,
      };
    });
  });
}

const getColor = (type) => {
  switch (type) {
    case "integer":
      return "#a456e5";
    case "string":
      return "#2bb74a";
    case "array":
      return "#f1ee07";
    case "boolean":
      return "#FF4747";
  }
};

const isEmptyOrNull = (obj) =>
  obj == null ||
  (Array.isArray(obj) && obj.length === 0) ||
  (typeof obj === "object" && Object.keys(obj).length === 0);

const stringifyError = (err) => {
  console.log(typeof err);
  console.log(obj);
  var obj = JSON.parse(JSON.stringify(err));
  console.log(obj);
  if (obj.stack) {
    obj.stack = obj.stack.split("\n");
  }

  return obj;
};

const convertType = (type) => {
  switch (type) {
    case "headers":
      return "header";
    case "cookies":
      return "cookie";
    case "params":
      return "path";
    default:
      return type;
  }
};

function validateRequiredFields(required, fields) {
  return Object.keys(required).every((key) => {
    return required[key].every((requiredName) => {
      return fields[key].some(
        (field) => field.name === toCamelCase(requiredName)
      );
    });
  });
}

async function getRequestFields(req) {
  const fields = { header: [], cookie: [], body: [], path: [], query: [] };

  ["headers", "cookies", "body", "params", "query"].map((type) => {
    if (req[type]) {
      Object.keys(req[type]).map((typeKey) => {
        fields[convertType(type)].push({
          name: toCamelCase(typeKey),
          type: null,
          value: req[type][typeKey],
        });
      });
    }
  });

  return fields;
}

function edgeConvert(source, edge) {
  const targetname = source ? "sourceHandle" : "targetHandle";
  const match = edge[targetname].match(/\(([^)]+)\)/);
  if (match) return toCamelCase(match[1]); // Return an array with the match
}

function toCamelCase(str) {
  return str
    .replace(/-([a-z])/gi, (match, group1) => group1.toUpperCase())
    .replace(/^./, (match) => match.toLowerCase());
}

module.exports = {
  calculateElapsedTime,
  getDataFromPath,
  generateRandomString,
  getReqFields,
  getColor,
  isEmptyOrNull,
  stringifyError,
  convertType,
  validateRequiredFields,
  getRequestFields,
  toCamelCase,
  edgeConvert,
};

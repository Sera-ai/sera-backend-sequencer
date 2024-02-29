function calculateElapsedTime(start, end) {
    return ((end[0] * 1000 + end[1] / 1e6) - (start[0] * 1000 + start[1] / 1e6)).toFixed(2) + "ms";
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
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }
    return result;
}

async function getOasFields(req, oas) {
    try {
        const url = req.protocol + "://" + req.hostname + req.path + "/" + req.method.toLowerCase()
        const parsed = new URL(url)
        const splitPath = parsed.pathname.split("/").slice(1);
        const oasPathways = splitPath.map((path, index) => {
            return (index === splitPath.length - 1) ? path : "/" + path;
        });
        const pathwayData = getDataFromPath(oasPathways, oas.paths);
        const lastSlashIndex = parsed.pathname.lastIndexOf('/');
        const method = (parsed.pathname.substring(lastSlashIndex + 1)).toUpperCase(); // "boop"

        if (method != "GET" && pathwayData) {
            const refId = pathwayData.requestBody.content[Object.keys(pathwayData.requestBody.content)[0]].schema.$ref;
            const parsedRefId = refId.split("/").slice(1);
            const refData = getDataFromPath(parsedRefId, oas);

            const propertiesWithRequired = Object.keys(refData.properties).map(field => {
                return {
                    [field]: {
                        ...refData.properties[field],
                        required: refData.required ? refData.required.includes(field) : false
                    }
                };
            });

            return [propertiesWithRequired, method];
        } else {
            return [null, method]
        }
    } catch (e) {
        console.log(e)
    }
}


async function getOasResFields(req, oas) {
    try {
        const url = req.protocol + "://" + req.hostname + req.path + "/" + req.method.toLowerCase();
        const parsed = new URL(url);
        const splitPath = parsed.pathname.split("/").slice(1);
        const oasPathways = splitPath.map((path, index) => {
            return (index === splitPath.length - 1) ? path : "/" + path;
        });
        const pathwayData = getDataFromPath(oasPathways, oas.paths);
        const lastSlashIndex = parsed.pathname.lastIndexOf('/');
        const method = (parsed.pathname.substring(lastSlashIndex + 1)).toUpperCase();

        if (pathwayData && pathwayData.responses) {
            const responsesData = Object.entries(pathwayData.responses).map(([statusCode, responseData]) => {
                if (responseData.content) {
                    const refId = responseData.content[Object.keys(responseData.content)[0]].schema.$ref;
                    const parsedRefId = refId.split("/").slice(1);
                    const refData = getDataFromPath(parsedRefId, oas);

                    return {
                        [statusCode]: Object.keys(refData.properties).map(field => ({
                            [field]: {
                                ...refData.properties[field],
                                required: refData.required ? refData.required.includes(field) : false
                            }
                        }))
                    };
                }
                return null;
            }).filter(response => response !== null);  // Remove any null responses

            return [responsesData, method];
        } else {
            return [null, method];
        }
    } catch (e) {
        console.log(e);
    }
}



function getReqFields(req) {
    return Object.entries(req.body).map(([key, value]) => {
        return {
            [key]: typeof value,
        };
    });
}

const getColor = (type) => {
    switch (type) {
        case "integer": return "#a456e5";
        case "string": return "#2bb74a";
        case "array": return "#f1ee07";
        case "boolean": return "#FF4747";
    }
}

const isEmptyOrNull = (obj) => obj == null || (Array.isArray(obj) && obj.length === 0) || (typeof obj === 'object' && Object.keys(obj).length === 0);

module.exports = {
    calculateElapsedTime,
    getDataFromPath,
    generateRandomString,
    getOasFields,
    getReqFields,
    getOasResFields,
    getColor,
    isEmptyOrNull,
}
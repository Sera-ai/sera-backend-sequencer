const babel = require("@babel/core");
const { edgeConvert } = require("../2.helpers/helpers.general");
const t = babel.types; // Shortcut for babel.types
const generate = require("@babel/generator").default;

async function getApiNodeScript({
  node,
  RequestFields,
  code,
  edges,
  urlData,
  seraHost,
  requestScript,
}) {
  if (!node?.data?.headerType) return ``;

  let code2 = code;
  switch (node.data.headerType) {
    case 1:
      code2 = await requestIncomingTemplate(
        node,
        RequestFields,
        urlData,
        seraHost
      );
      break;
    case 2:
      code2 = await requestOutgoingTemplate(
        node,
        RequestFields,
        code2,
        edges,
        urlData
      );
      break;
    case 3:
      code2 = await responseIncomingTemplate({
        node,
        requestScript
      });
      break;
    case 4:
      //script.push(responseOutgoingTemplate(node, RequestFields));
      break;
  }

  return code2;
  //headerType 1 is generating the params that will be used throughout the application
  //headerType 2 is sending the request
  //headerType 3 is receiving the reponse from the server
  //headerType 4 is returning the data back to the client
}

async function requestIncomingTemplate(
  node,
  RequestFields,
  urlData2,
  seraHost
) {
  const code = `async function sera_${node.id}() { }`;
  const ast = babel.parse(code);

  let urlData = urlData2;
  urlData["url"] = `${
    seraHost.sera_config.https ? "https" : urlData.protocol
  }://${seraHost.frwd_config.host}${urlData.path}`;

  const functionDeclarationIndex = ast.program.body.findIndex(
    (node) => node.type === "FunctionDeclaration"
  );

  if (functionDeclarationIndex !== -1) {
    const functionDeclaration = ast.program.body[functionDeclarationIndex];
    const paramDeclarations = Object.keys(RequestFields).flatMap(
      (fieldType) => {
        return RequestFields[fieldType].map((field) => {
          console.log(field);
          return t.variableDeclarator(
            t.identifier(field.name),
            t.stringLiteral(field.value)
          );
        });
      }
    );

    //bring in url vars

    ast.program.body.splice(
      functionDeclarationIndex,
      0,
      t.variableDeclaration("let", paramDeclarations)
    );

    const requestDeclarations = Object.keys(urlData).map((field) => {
      console.log(field);
      return t.variableDeclarator(
        t.identifier(field),
        t.stringLiteral(urlData[field])
      );
    });

    //bring in url vars

    ast.program.body.splice(
      functionDeclarationIndex,
      0,
      t.variableDeclaration("let", requestDeclarations)
    );

    node.params?.inParams?.forEach((param) => {
      functionDeclaration.params.push(t.identifier(param));
    });

    node.params?.outParams?.forEach((param) => {
      functionDeclaration.params.push(t.identifier(param));
    });

    // const functionCall = t.expressionStatement(
    //   t.callExpression(t.identifier(`sera_${node.id}`), [])
    // );
    // ast.program.body.push(functionCall);
  }

  const output = generate(ast);

  return output.code;
}

async function requestOutgoingTemplate(
  node,
  RequestFields,
  code,
  edges,
  urlData
) {
  const ast = babel.parse(code);

  const nodeEdges = edges.filter((edge) => edge.target == node.id);
  const translateEdge = (edgeName) => {
    const grabEdge = nodeEdges.filter((edge) => {
      return edgeConvert(false, edge) == edgeName; // Ensure to return the condition
    });
    if (grabEdge.length > 0) return edgeConvert(true, grabEdge[0]);
    return null;
  };

  // Function to create the new async function 'sera[node.id]'
  function createRequestOutgoingFunction() {
    const variableDeclarations = Object.keys(RequestFields).reduce(
      (acc, key) => {
        const fieldArray = RequestFields[key];
        if (fieldArray.length > 0) {
          // Map over the field array and create properties only for non-null translations
          const properties = fieldArray
            .map((field) => {
              const translatedEdge = translateEdge(field.name);
              return translatedEdge
                ? t.objectProperty(
                    t.identifier(field.name),
                    t.identifier(translatedEdge)
                  )
                : t.objectProperty(
                    t.identifier(field.name),
                    t.identifier(`"${field.value}"`)
                  );
            })
            .filter((property) => property !== null); // Filter out null entries

          if (properties.length > 0) {
            const variableDecl = t.variableDeclaration("let", [
              t.variableDeclarator(
                t.identifier(key),
                t.objectExpression(properties)
              ),
            ]);
            acc.push(variableDecl);
          }
        }
        return acc;
      },
      []
    );

    console.log(RequestFields);
    const functionBody = t.blockStatement([
      ...variableDeclarations,
      t.returnStatement(
        t.awaitExpression(
          t.callExpression(
            t.memberExpression(
              t.identifier("axios"),
              t.identifier("method.toLowerCase()"),
              true // computed property, true because method is a variable
            ),
            [
              t.identifier("url"),
              ...(urlData.method.toLowerCase() !== "get" &&
              RequestFields.body.length > 0
                ? [t.identifier("body")] // Include body only if not a GET request and body is non-empty
                : []),
              t.objectExpression([
                // Only include headers if they're declared and non-empty
                ...(RequestFields.header &&
                false &&
                RequestFields.header.length > 0
                  ? [
                      t.objectProperty(
                        t.identifier("headers"),
                        t.identifier("header") // Assuming headers is a variable containing the headers object
                      ),
                    ]
                  : []),
                // Only include queryParams if they're declared and non-empty
                ...(RequestFields.query && RequestFields.query.length > 0
                  ? [
                      t.objectProperty(
                        t.identifier("params"),
                        t.identifier("queryParams") // Assuming queryParams is a variable containing the query parameters
                      ),
                    ]
                  : []),
              ]),
            ]
          )
        )
      ),
    ]);

    return t.functionDeclaration(
      t.identifier(`sera_${node.id}`),
      [],
      functionBody,
      false, // generator flag
      true // async flag
    );
  }

  // Find index of existing FunctionDeclaration or add if not present
  const functionDeclarationIndex = ast.program.body.findIndex(
    (node) => node.type === "FunctionDeclaration"
  );

  if (functionDeclarationIndex !== -1) {
    const functionDeclaration = ast.program.body[functionDeclarationIndex];

    // Add the return statement inside the existing function body
    functionDeclaration.body.body.push(
      t.returnStatement(
        t.awaitExpression(t.callExpression(t.identifier(`sera_${node.id}`), []))
      )
    );
  }

  // Add the new function 'sera[node.id]' to the AST
  ast.program.body.push(createRequestOutgoingFunction());

  const output = generate(ast);
  return output.code;
}

function responseIncomingTemplate({ node, requestScript }) {

  //strip out the prior function start
  const ast = babel.parse(requestScript);
  const newBody = ast.program.body.filter(
    (n) =>
      !(
        n.type === "ExpressionStatement" &&
        n.expression.type === "CallExpression"
      )
  );
  ast.program.body = newBody;

  const output = generate(ast);

  return output.code;
}

function responseOutgoingTemplate() {}

module.exports = {
  getApiNodeScript,
};

const babel = require("@babel/core");
const { edgeConvert } = require("../helpers/helpers.general");
const t = babel.types; // Shortcut for babel.types
const generate = require("@babel/generator").default;

async function getApiNodeScript(node, RequestFields, code2, edges) {
  if (!node?.data?.headerType) return ``;

  let code = code2;
  switch (node.data.headerType) {
    case 1:
      code = await requestIncomingTemplate(node, RequestFields);
      break;
    case 2:
      code = await requestOutgoingTemplate(node, RequestFields, code, edges);
      break;
    case 3:
      //script.push(responseIncomingTemplate(node, RequestFields));
      break;
    case 4:
      //script.push(responseOutgoingTemplate(node, RequestFields));
      break;
  }

  return code;
  //headerType 1 is generating the params that will be used throughout the application
  //headerType 2 is sending the request
  //headerType 3 is receiving the reponse from the server
  //headerType 4 is returning the data back to the client
}

async function requestIncomingTemplate(node, RequestFields) {
  const code = `async function sera${node.id}() { }`;
  const ast = babel.parse(code);

  const functionDeclarationIndex = ast.program.body.findIndex(
    (node) => node.type === "FunctionDeclaration"
  );

  if (functionDeclarationIndex !== -1) {
    const functionDeclaration = ast.program.body[functionDeclarationIndex];
    const letDeclarations = Object.keys(RequestFields).flatMap((fieldType) => {
      return RequestFields[fieldType].map((field) => {
        console.log(field);
        return t.variableDeclarator(
          t.identifier(field.name),
          t.stringLiteral(field.value)
        );
      });
    });

    //bring in url vars

    ast.program.body.splice(
      functionDeclarationIndex,
      0,
      t.variableDeclaration("let", letDeclarations)
    );

    node.params?.inParams?.forEach((param) => {
      functionDeclaration.params.push(t.identifier(param));
    });

    node.params?.outParams?.forEach((param) => {
      functionDeclaration.params.push(t.identifier(param));
    });

    const functionCall = t.expressionStatement(
      t.callExpression(t.identifier(`sera${node.id}`), [])
    );
    ast.program.body.push(functionCall);
  }

  const output = generate(ast);

  return output.code;
}

async function requestOutgoingTemplate(node, RequestFields, code, edges) {
  const ast = babel.parse(code);

  const nodeEdges = edges.filter((edge) => edge.target == node.id);
  const translateEdge = (edgeName) => {
    const grabEdge = nodeEdges.filter((edge) => {
      return edgeConvert(false, edge) == edgeName;  // Ensure to return the condition
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
          const properties = fieldArray.map((field) => {
            const translatedEdge = translateEdge(field.name);
            return translatedEdge ? 
              t.objectProperty(
                t.identifier(field.name),
                t.identifier(translatedEdge)
              ) : null;
          }).filter(property => property !== null);  // Filter out null entries
  
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
    const functionBody = t.blockStatement([
      ...variableDeclarations,
      t.returnStatement(
        t.awaitExpression(
          t.callExpression(
            t.memberExpression(
              t.identifier("axios"),
              t.identifier("method"),
              true // computed property, true because method is a variable
            ),
            [
              t.identifier("url"),
              t.identifier("body"), // Assumes 'body' will always be declared
              t.objectExpression([
                // Only include headers if it's declared
                ...(RequestFields.header && RequestFields.header.length > 0
                  ? [
                      t.objectProperty(
                        t.identifier("headers"),
                        t.identifier("header")
                      ),
                    ]
                  : []),
                // Only include queryParams if it's declared
                ...(RequestFields.query && RequestFields.query.length > 0
                  ? [
                      t.objectProperty(
                        t.identifier("params"),
                        t.identifier("queryParams")
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
      t.identifier(`sera${node.id}`),
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
        t.awaitExpression(t.callExpression(t.identifier(`sera${node.id}`), []))
      )
    );
  }

  // Add the new function 'sera[node.id]' to the AST
  ast.program.body.push(createRequestOutgoingFunction());

  const output = generate(ast);
  return output.code;
}

function responseIncomingTemplate() {}

function responseOutgoingTemplate() {}

module.exports = {
  getApiNodeScript,
};

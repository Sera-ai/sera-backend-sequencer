const babel = require("@babel/core");
const { edgeConvert } = require("../helpers/helpers.general");
const t = babel.types; // Shortcut for babel.types
const generate = require("@babel/generator").default;

async function getScriptNodeScript({
  node,
  RequestFields,
  code,
  edges,
  urlData,
  seraHost,
  requestScript,
}) {
  console.log("script")
  return code;
  if (!node?.data?.headerType) return ``;

  const ast = babel.parse(code);

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

    const functionCall = t.expressionStatement(
      t.callExpression(t.identifier(`sera_${node.id}`), [])
    );
    ast.program.body.push(functionCall);
  }

  const output = generate(ast);

  return output.code;
  //headerType 1 is generating the params that will be used throughout the application
  //headerType 2 is sending the request
  //headerType 3 is receiving the reponse from the server
  //headerType 4 is returning the data back to the client
}

async function scriptTemplate(node, RequestFields, urlData2, seraHost) {}

module.exports = {
  getScriptNodeScript,
};

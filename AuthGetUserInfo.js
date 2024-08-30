"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
// lib/functions/get-user-info.ts
var get_user_info_exports = {};
__export(get_user_info_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(get_user_info_exports);
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");

var handler = async (event) => {
  const client = new import_client_cognito_identity_provider.CognitoIdentityProviderClient();
  const username = event.requestContext.authorizer.jwt.claims.sub;
  try {
    const command = new import_client_cognito_identity_provider.AdminGetUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: username
    });
    const response = await client.send(command);
    const email = response.UserAttributes.find((attr) => attr.Name === "email")?.Value;
    const nickname = response.UserAttributes.find((attr) => attr.Name === "nickname")?.Value || username;
    return {
      statusCode: 200,
      body: JSON.stringify({ email, nickname })
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
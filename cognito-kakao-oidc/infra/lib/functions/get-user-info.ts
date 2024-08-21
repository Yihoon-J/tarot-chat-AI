import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";

export const handler = async (event) => {
  const client = new CognitoIdentityProviderClient();
  const username = event.requestContext.authorizer.jwt.claims.sub;

  try {
    const command = new AdminGetUserCommand({
      UserPoolId: process.env.USER_POOL_ID,
      Username: username,
    });
    const response = await client.send(command);

    const email = response.UserAttributes.find(attr => attr.Name === 'email')?.Value;

    return {
      statusCode: 200,
      body: JSON.stringify({ email }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
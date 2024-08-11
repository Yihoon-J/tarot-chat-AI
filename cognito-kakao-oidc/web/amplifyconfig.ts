import type { ResourcesConfig, AuthUserPoolConfig } from '@aws-amplify/core';

const DomainName = 'kakaoauthdemodev312210210072'; // TODO: replace with actual domainName

const AuthConfig: AuthUserPoolConfig = {
  Cognito: {
    userPoolId: 'us-east-1_qo0eomUul', // TODO: replace with actual cognito userpoolid
    userPoolClientId: 'v6v2f1g2ce9pdotmn2fjlrv65', // TODO: replace with actual cognito clientid
    loginWith: {
      oauth: {
        domain: `${DomainName}.auth.us-east-1.amazoncognito.com`,
        scopes: ['openid'],
        redirectSignIn: ['http://localhost:3000/callback'],
        redirectSignOut: ['http://localhost:3000'],
        responseType: 'token',
      },
      username: true,
    },
  },
};

export const AmplifyConfig: ResourcesConfig = {
  Auth: AuthConfig,
};

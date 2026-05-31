import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.COGNITO_REGION || process.env.AWS_REGION || "us-east-1";

export const cognitoClient = new CognitoIdentityProviderClient({
    region,
});

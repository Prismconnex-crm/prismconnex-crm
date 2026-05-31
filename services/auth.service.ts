import {
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
    AuthFlowType
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "@/lib/auth/cognito-client";
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors";

const clientId = process.env.COGNITO_CLIENT_ID || "";

export class AuthService {
    static async signUp(email: string, password: string, name: string) {
        try {
            const command = new SignUpCommand({
                ClientId: clientId,
                Username: email,
                Password: password,
                UserAttributes: [
                    { Name: "email", Value: email },
                    { Name: "name", Value: name },
                ],
            });
            await cognitoClient.send(command);
        } catch (error: any) {
            if (error.name === "UsernameExistsException") {
                throw new BadRequestError("User already exists");
            }
            throw new BadRequestError(error.message || "Failed to sign up");
        }
    }

    static async verify(email: string, code: string) {
        try {
            const command = new ConfirmSignUpCommand({
                ClientId: clientId,
                Username: email,
                ConfirmationCode: code,
            });
            await cognitoClient.send(command);
        } catch (error: any) {
            throw new BadRequestError(error.message || "Failed to verify email");
        }
    }

    static async signIn(email: string, password: string) {
        try {
            const command = new InitiateAuthCommand({
                AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
                ClientId: clientId,
                AuthParameters: {
                    USERNAME: email,
                    PASSWORD: password,
                },
            });

            const response = await cognitoClient.send(command);

            if (!response.AuthenticationResult?.IdToken) {
                throw new UnauthorizedError("Invalid credentials");
            }

            return {
                idToken: response.AuthenticationResult.IdToken,
                accessToken: response.AuthenticationResult.AccessToken,
                refreshToken: response.AuthenticationResult.RefreshToken,
            };
        } catch (error: any) {
            if (error.name === "NotAuthorizedException" || error.name === "UserNotFoundException") {
                throw new UnauthorizedError("Invalid credentials");
            }
            if (error.name === "UserNotConfirmedException") {
                throw new UnauthorizedError("User is not confirmed");
            }
            throw new BadRequestError(error.message || "Failed to sign in");
        }
    }
}

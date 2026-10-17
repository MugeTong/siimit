export type DeviceCodeResponse = {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
};

export type OAuthError = {
    error: string;
    error_description: string;
}

export type OAuthTokenResponse = {
    access_token: string;
    expires_in: number;
    refresh_expires_in: number;
    refresh_token: string;
    token_type: string;
    session_state: string;
    scope: string;
};

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
    const url = new URL("https://keycloak-inspire-prod.sii.edu.cn/realms/inf-internal/protocol/openid-connect/auth/device");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: "inspire-code",
        }),
    });
    if (!response.ok) {
        const errorData = await response.json() as OAuthError;
        throw new Error(`Failed to request device code: ${response.status} - ${errorData.error}`);
    }
    const data = await response.json() as DeviceCodeResponse;
    return data;
}

async function pollForAuth(deviceCode: string, expiresIn: number, interval: number): Promise<OAuthTokenResponse> {
    const url = new URL("https://keycloak-inspire-prod.sii.edu.cn/realms/inf-internal/protocol/openid-connect/token");
    const expireTime = Date.now() + expiresIn * 1000;
    while (Date.now() < expireTime) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: "inspire-code",
                grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                device_code: deviceCode,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json() as OAuthError;
            if (errorData.error === "authorization_pending") {
                // User has not yet completed the authentication, wait and retry
                await new Promise((resolve) => setTimeout(resolve, interval * 1000));
                continue;
            }
            throw new Error(`Failed to poll for token: ${response.status} - ${errorData.error}`);
        }
        const data = await response.json() as OAuthTokenResponse;
        return data;
    }
    throw new Error("Failed to obtain access token: timeout");
}

async function refreshAuth(refreshToken: string): Promise<OAuthTokenResponse> {
    const url = new URL("https://keycloak-inspire-prod.sii.edu.cn/realms/inf-internal/protocol/openid-connect/token");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: "inspire-code",
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });
    if (!response.ok) {
        const errorData = await response.json() as OAuthError;
        throw new Error(`Failed to refresh token: ${response.status} - ${errorData.error}`);
    }
    const data = await response.json() as OAuthTokenResponse;
    return data;
}

export const authApi = {
    requestDeviceCode,
    pollForAuth,
    refreshAuth,
}

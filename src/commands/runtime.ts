import { loginHttp } from "../platform/auth";
import { InspireClient } from "../platform/client";
import { loadCredentials, loadSession, saveSession, type BrowserSession } from "../config";
import { AuthenticationError, ConfigurationError } from "../errors";

export async function sessionOrLogin(): Promise<BrowserSession> {
  try {
    return await loadSession();
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return loginWithSavedCredentials();
  }
}

export async function loginWithSavedCredentials(): Promise<BrowserSession> {
  const credentials = await loadCredentials();
  const session = await loginHttp(credentials);
  await saveSession(session);
  return session;
}

export async function withClient<T>(operation: (client: InspireClient) => Promise<T>): Promise<T> {
  try {
    return await operation(new InspireClient(await sessionOrLogin()));
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    return operation(new InspireClient(await loginWithSavedCredentials()));
  }
}

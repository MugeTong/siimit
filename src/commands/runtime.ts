import { InspireClient } from "../platform/client";

export async function withClient<T>(operation: (client: InspireClient) => Promise<T>): Promise<T> {
  return operation(new InspireClient());
}

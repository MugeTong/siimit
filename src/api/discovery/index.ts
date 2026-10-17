type RouteMetadata = {
    Name: string;
    Path: string;
    Description: string;
    Actions: Array<{
        Name: string;
        Description: string;
        Parameters: Array<{
            Name: string;
            Type: string;
            Required: boolean;
        }>;
        Response: Array<{
            Name: string;
            Type: string;
        }>;
    }>;
}

type DiscoveryResponse = {
    ResponseMetadata: {
        Action: string;
        Service: string;
    };
    Result: {
        Services: Array<RouteMetadata>;
        Version: string;
    };
}


async function fetchDiscovery(): Promise<DiscoveryResponse> {
    const url = new URL("/discovery", "https://qz.sii.edu.cn");

    const response = await fetch(url, {
        headers: {
            "Accept": "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch discovery data: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json() as DiscoveryResponse;
    return data;
}

async function checkDiscovery(version: string): Promise<[boolean, DiscoveryResponse | null]> {
    const url = new URL("/discovery", "https://qz.sii.edu.cn");
    const response = await fetch(url, {
        headers: {
            "Accept": "application/json",
            "If-None-Match": `"${version}"`,
        },
    });

    if (response.status === 304) {
        return [false, null]; // Discovery data has not changed
    } else if (!response.ok) {
        throw new Error(`Failed to check discovery data: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json() as DiscoveryResponse;
    return [true, data]; // Discovery data has changed
}


export const discoveryApi = {
    fetchDiscovery,
    checkDiscovery,
}

import { authStorage } from "@/storage";
import { discoveryStorage } from "@/storage";

async function getProjects(): Promise<void> {
    const url = new URL("")
    // Simulate an API call with a delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Projects fetched successfully.");
}


export const projectsApi = {
    getProjects,
}

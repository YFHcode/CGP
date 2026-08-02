import { createClient } from "next-sanity";

export const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "lftmpe5q",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
    apiVersion: "2024-01-01",
    // The CDN is the right default for published, cached content: it is faster
    // and cheaper than hitting the API origin on every single request.
    useCdn: true,
});

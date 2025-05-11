import {ModelDownloadEndpoints, resolveHuggingFaceEndpoint} from "../../utils/modelDownloadEndpoints.js";

export function normalizeGgufDownloadUrl(url: string, endpoints?: ModelDownloadEndpoints) {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname === "huggingface.co" || parsedUrl.hostname === "hf.co" ||
        parsedUrl.hostname === (new URL(resolveHuggingFaceEndpoint(endpoints))).hostname
    ) {
        const pathnameParts = parsedUrl.pathname.split("/");

        if (pathnameParts.length > 3 && pathnameParts[3] === "blob") {
            const newUrl = new URL(url);
            pathnameParts[3] = "resolve";
            newUrl.pathname = pathnameParts.join("/");

            if (newUrl.searchParams.get("download") !== "true")
                newUrl.searchParams.set("download", "true");

            return newUrl.href;
        }
    }

    return url;
}

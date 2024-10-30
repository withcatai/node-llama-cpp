export const defaultDownloadElectronExampleAppLink = "https://github.com/withcatai/node-llama-cpp/releases/latest";

async function getLatestRelease(): Promise<Release | null> {
    try {
        // const releaseRes = await fetch("https://api.github.com/repos/withcatai/node-llama-cpp/releases/tags/v3.0.0-beta.32");
        const releaseRes = await fetch("https://api.github.com/repos/withcatai/node-llama-cpp/releases/latest");
        const release: Release = await releaseRes.json();

        if (release?.assets_url == null || release?.html_url == null)
            return null;

        return release;
    } catch (err) {
        console.error(err);
        return null;
    }
}

async function getReleaseAssets(release: Release) {
    const assets = await (await fetch(release.assets_url)).json() as Asset[];

    return assets.filter((asset) => asset.state === "uploaded");
}

export async function getElectronExampleAppDownloadLink() {
    if (typeof navigator === "undefined")
        return defaultDownloadElectronExampleAppLink;

    const platformInfo: null | {
        architecture?: "arm" | "x86",
        bitness?: string,
        mobile: boolean,
        platform?: "macOS" | "Windows" | "Linux" | "Unknown"
    } = (await (navigator as any)?.userAgentData?.getHighEntropyValues?.(["architecture", "bitness"])) ?? null;

    const isMacOs = platformInfo?.platform != null
        ? platformInfo.platform === "macOS"
        : (navigator.userAgent.includes("Mac OS X") || navigator.userAgent.includes("Macintosh"));
    const isWindows = platformInfo?.platform != null
        ? platformInfo.platform === "Windows"
        : navigator.userAgent.includes("Windows");
    const isLinux = platformInfo?.platform != null
        ? platformInfo.platform === "Linux"
        : (navigator.userAgent.includes("Linux") && !isWindows && !isMacOs);
    const isMobile = platformInfo?.platform != null
        ? platformInfo.mobile
        : navigator.userAgent.includes("Mobile");

    const x64 = (platformInfo?.architecture != null && platformInfo?.bitness != null)
        ? (platformInfo.architecture === "x86" && platformInfo.bitness === "64")
        : navigator.userAgent.includes("x64");
    const arm64 = (platformInfo?.architecture != null && platformInfo?.bitness != null)
        ? (platformInfo.architecture === "arm" && platformInfo.bitness === "64")
        : navigator.userAgent.includes("arm64");

    const latestRelease = await getLatestRelease();

    function filterByArchitecture(asset: Asset) {
        if (arm64)
            return asset.name.includes(".arm64.");
        else if (x64)
            return asset.name.includes(".x64.") || asset.name.includes(".x86_64.");

        return false;
    }

    if (latestRelease != null && !isMobile && (x64 || arm64)) {
        try {
            const assets = (await getReleaseAssets(latestRelease)) ?? [];
            let relevantAssets: Asset[] = [];

            if (isMacOs) {
                relevantAssets = assets
                    .filter((asset) => asset.name.includes(".macOS."))
                    .filter(filterByArchitecture)
                    .filter((asset) => asset.name.endsWith(".dmg"));
            } else if (isWindows) {
                relevantAssets = assets
                    .filter((asset) => asset.name.includes(".Windows."))
                    .filter(filterByArchitecture)
                    .filter((asset) => asset.name.endsWith(".exe"));
            } else if (isLinux) {
                relevantAssets = assets
                    .filter((asset) => asset.name.includes(".Linux."))
                    .filter(filterByArchitecture)
                    .filter((asset) => asset.name.endsWith(".AppImage"));
            }

            if (relevantAssets.length > 0 && relevantAssets[0]!.browser_download_url != null)
                return relevantAssets[0]!.browser_download_url;
        } catch (err) {
            console.error(err);
        }
    }

    return latestRelease?.html_url ?? defaultDownloadElectronExampleAppLink;
}

type Release = {
    assets_url: string,
    html_url: string
};
type Asset = {
    browser_download_url: string,
    name: string,
    state: "uploaded" | "open"
};

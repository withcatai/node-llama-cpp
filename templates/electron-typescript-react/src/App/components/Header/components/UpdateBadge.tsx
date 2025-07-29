import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {withLock} from "lifecycle-utils";
import semver from "semver";

import "./UpdateBadge.css";

const latestReleaseUrl = "https://github.com/withcatai/node-llama-cpp/releases/latest";
const checkInterval = 1000 * 60 * 60 * 24;


export function UpdateBadge({appVersion, canShowCurrentVersion}: UpdateBadgeProps) {
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const [releaseLink, setReleaseLink] = useState<string | null>(null);
    const shouldUpdateCurrentVersion = useRef(true);
    const nextUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const instanceLock = useRef({});

    const appVersionIsBeta = useMemo(() => {
        if (appVersion == null)
            return null;

        const componenets = semver.prerelease(appVersion);
        return componenets?.includes("beta") ?? false;
    }, [appVersion]);

    const updateLatestVersionInfo = useCallback(async () => {
        clearTimeout(nextUpdateTimeoutRef.current);
        await withLock([instanceLock.current, "updateVersion"], async () => {
            clearTimeout(nextUpdateTimeoutRef.current);

            const latestVersion = await getLatestAvailableVersion(appVersionIsBeta ?? false);
            if (shouldUpdateCurrentVersion.current && latestVersion.version != null) {
                setLatestVersion(latestVersion.version);
                setReleaseLink(latestVersion.url);
            }

            nextUpdateTimeoutRef.current = setTimeout(updateLatestVersionInfo, checkInterval);
        });
    }, [appVersionIsBeta]);

    useEffect(() => {
        if (appVersionIsBeta == null)
            return;

        shouldUpdateCurrentVersion.current = true;
        void updateLatestVersionInfo();

        return () => {
            shouldUpdateCurrentVersion.current = false;
            clearTimeout(nextUpdateTimeoutRef.current);
        };
    }, [appVersionIsBeta]);

    const releasedVersionIsNewerThanCurrent = useMemo(() => {
        if (appVersion == null || latestVersion == null)
            return false;

        try {
            return semver.gt(latestVersion, appVersion);
        } catch (err) {
            return true;
        }
    }, [appVersion, latestVersion]);

    if (latestVersion == null)
        return null;

    return <div className="updateBadge">
        {
            (!releasedVersionIsNewerThanCurrent && appVersion && canShowCurrentVersion) &&
            <div className="currentVersion"><code>v{appVersion}</code></div>
        }
        {
            (releasedVersionIsNewerThanCurrent && releaseLink != null) &&
            <a
                target="_blank"
                href={releaseLink}
                className="newVersion"
            >
                Version <code className="version">{latestVersion}</code> is available
            </a>
        }
    </div>;
}

type UpdateBadgeProps = {
    appVersion?: string,
    canShowCurrentVersion?: boolean
};

async function getLatestAvailableVersion(includePrerelease: boolean = false): Promise<{
    version?: string,
    url: string
}> {
    try {
        if (includePrerelease) {
            const latestReleases = await getLatestPrereleaseAndRelease();
            if (latestReleases.latestPrerelease != null && latestReleases.latestRelease != null) {
                if (semver.gt(latestReleases.latestPrerelease.version, latestReleases.latestRelease.version))
                    return {
                        version: latestReleases.latestPrerelease.version,
                        url: latestReleases.latestPrerelease.url
                    };

                return {
                    version: latestReleases.latestRelease.version,
                    url: latestReleaseUrl
                };
            } else if (latestReleases.latestPrerelease != null) {
                return {
                    version: latestReleases.latestPrerelease.version,
                    url: latestReleases.latestPrerelease.url
                };
            } else if (latestReleases.latestRelease != null) {
                return {
                    version: latestReleases.latestRelease.version,
                    url: latestReleaseUrl
                };
            }
        }

        const releaseRes = await fetch("https://api.github.com/repos/withcatai/node-llama-cpp/releases/latest");
        const release: {
            tag_name: string
        } = await releaseRes.json();

        return {
            version: normalizeTagName(release?.tag_name),
            url: latestReleaseUrl
        };
    } catch (err) {
        console.error(err);
        return {
            version: undefined,
            url: latestReleaseUrl
        };
    }
}

async function getLatestPrereleaseAndRelease(): Promise<{
    latestRelease?: {
        version: string,
        url: string
    },
    latestPrerelease?: {
        version: string,
        url: string
    }
}> {
    try {
        const releasesRes = await fetch("https://api.github.com/repos/withcatai/node-llama-cpp/releases?per_page=100");
        const releases: Array<{
            tag_name: string,
            html_url: string,
            prerelease: boolean,
            draft: boolean
        }> = await releasesRes.json();

        const latestRelease = releases.find((release) => !release.prerelease && !release.draft);
        const latestPrerelease = releases.find((release) => release.prerelease && !release.draft);

        return {
            latestRelease: latestRelease == null ? undefined : {
                version: normalizeTagName(latestRelease.tag_name)!,
                url: latestRelease.html_url
            },
            latestPrerelease: latestPrerelease == null ? undefined : {
                version: normalizeTagName(latestPrerelease.tag_name)!,
                url: latestPrerelease.html_url
            }
        };
    } catch (err) {
        console.error(err);
        return {};
    }
}

function normalizeTagName(tagName?: string) {
    if (tagName == null)
        return undefined;

    if (tagName.toLowerCase().startsWith("v"))
        return tagName.slice("v".length);

    return tagName;
}

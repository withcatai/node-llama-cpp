import path from "path";
import fs from "fs-extra";
import {lastBuildInfoJsonPath, llamaLocalBuildBinsDirectory} from "../../config.js";
import {clearTempFolder} from "../../utils/clearTempFolder.js";
import {withLockfile} from "../../utils/withLockfile.js";
import {isLockfileActive} from "../../utils/isLockfileActive.js";
import {getConsoleLogPrefix} from "../../utils/getConsoleLogPrefix.js";

export async function clearAllLocalBuilds(waitForLocks = false) {
    async function removeBuilds() {
        const itemsToRemove = Array.from(
            new Set(
                (await fs.readdir(llamaLocalBuildBinsDirectory))
                    .map((item) => (
                        item.endsWith(".lock")
                            ? item.slice(0, -".lock".length)
                            : item
                    ))
                    .filter((item) => !item.startsWith("."))
            )
        );

        let hasLocks = false;
        const buildRemovals = itemsToRemove.map(async (item) => {
            const absolutePath = path.join(llamaLocalBuildBinsDirectory, item);
            const pathIsLocked = await isLockfileActive({resourcePath: absolutePath});

            hasLocks ||= pathIsLocked;

            if (waitForLocks)
                await withLockfile({
                    resourcePath: absolutePath
                }, async () => {
                    await fs.remove(absolutePath);
                });
            else if (!pathIsLocked)
                await fs.remove(absolutePath);
        });

        return {
            buildRemovals,
            hasLocks
        };
    }

    if (await fs.pathExists(llamaLocalBuildBinsDirectory)) {
        const {hasLocks, buildRemovals} = await removeBuilds();

        if (hasLocks) {
            if (waitForLocks)
                console.log(getConsoleLogPrefix() + "Some builds are in progress. Waiting for those builds to finish before removing them.");
            else
                console.log(getConsoleLogPrefix() + "Some builds are in progress. Skipping the removal of those builds.");
        }

        await Promise.all(buildRemovals);
    }

    await fs.remove(lastBuildInfoJsonPath);
    await clearTempFolder();
}

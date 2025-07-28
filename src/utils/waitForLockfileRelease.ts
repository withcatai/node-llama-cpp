import lockfile from "proper-lockfile";
import {isLockActive, waitForLockRelease} from "lifecycle-utils";
import {lockfileLockScope} from "./withLockfile.js";

export async function waitForLockfileRelease({
    resourcePath, checkInterval = 1000 * 5.5, staleDuration = 1000 * 10
}: {
    resourcePath: string, checkInterval?: number, staleDuration?: number
}) {
    while (true) {
        if (isLockActive([lockfileLockScope, resourcePath])) {
            await waitForLockRelease([lockfileLockScope, resourcePath]);
            continue;
        }

        const lockfileActive = await lockfile.check(resourcePath, {stale: staleDuration, realpath: false});
        const lockIsActive = isLockActive([lockfileLockScope, resourcePath]);

        if (lockIsActive)
            continue;

        if (!lockfileActive)
            return;

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }
}

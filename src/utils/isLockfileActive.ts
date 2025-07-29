import lockfile from "proper-lockfile";
import {isLockActive} from "lifecycle-utils";
import {lockfileLockScope} from "./withLockfile.js";

export async function isLockfileActive({
    resourcePath, staleDuration = 1000 * 10
}: {
    resourcePath: string, staleDuration?: number
}) {
    if (isLockActive([lockfileLockScope, resourcePath]))
        return true;

    const lockfileActive = await lockfile.check(resourcePath, {stale: staleDuration, realpath: false});
    if (lockfileActive)
        return true;

    return isLockActive([lockfileLockScope, resourcePath]);
}

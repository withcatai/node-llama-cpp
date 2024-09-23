import path from "path";
import {fileURLToPath} from "url";
import semanticRelease from "semantic-release";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = await yargs(hideBin(process.argv))
    .option("saveReleaseToFile", {
        type: "string"
    })
    .option("saveVersionToFile", {
        type: "string"
    })
    .argv;

const {saveReleaseToFile, saveVersionToFile} = argv;

const res = await semanticRelease({
    dryRun: true
}, {
    cwd: path.join(__dirname, "..")
});

if (saveReleaseToFile != null) {
    const resolvedPath = path.resolve(process.cwd(), saveReleaseToFile);

    console.info("Writing release to file:", resolvedPath);
    await fs.writeFile(resolvedPath, JSON.stringify(res), "utf8");
}

if (saveVersionToFile != null) {
    const resolvedPath = path.resolve(process.cwd(), saveVersionToFile);

    console.info("Writing version to file:", resolvedPath);
    await fs.writeFile(
        resolvedPath,
        res === false
            ? "false"
            : res.nextRelease.version,
        "utf8"
    );
}

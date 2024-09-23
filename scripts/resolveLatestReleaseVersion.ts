import path from "path";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import fs from "fs-extra";

const argv = await yargs(hideBin(process.argv))
    .option("saveVersionToFile", {
        type: "string"
    })
    .argv;

const {saveVersionToFile} = argv;

const releaseRes = await fetch("https://api.github.com/repos/withcatai/node-llama-cpp/releases/latest");
const release: Release = await releaseRes.json();

let latestReleaseVersion = release.tag_name;
if (latestReleaseVersion.toLowerCase().startsWith("v"))
    latestReleaseVersion = latestReleaseVersion.slice("v".length);

if (latestReleaseVersion === "")
    throw new Error("Could not get latest release version");

console.log("Latest release version:", latestReleaseVersion);

if (saveVersionToFile != null) {
    const resolvedPath = path.resolve(process.cwd(), saveVersionToFile);

    console.info("Writing latest release version to file:", resolvedPath);
    await fs.writeFile(resolvedPath, latestReleaseVersion, "utf8");
}

type Release = {
    tag_name: string
};

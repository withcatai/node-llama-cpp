import path from "path";
import {fileURLToPath} from "url";
import semanticRelease from "semantic-release";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";
import fs from "fs-extra";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = await yargs(hideBin(process.argv))
    .option("saveToFile", {
        type: "string"
    })
    .argv;

const {saveToFile} = argv;

const res = await semanticRelease({
    dryRun: true
}, {
    cwd: path.join(__dirname, "..")
});

console.log("Result:", res);

if (saveToFile != null) {
    const resolvedPath = path.resolve(process.cwd(), saveToFile);

    console.info("Writing to file:", resolvedPath);
    await fs.writeFile(resolvedPath, JSON.stringify(res), "utf8");
}

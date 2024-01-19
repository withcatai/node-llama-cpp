import {downloadAllModels} from "../modelFiles.js";

console.info("Ensuring all models are downloaded");
await downloadAllModels();
process.exit(0);

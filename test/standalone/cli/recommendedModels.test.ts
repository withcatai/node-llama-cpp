import {describe, expect, test} from "vitest";
import {parseModelUri, resolveParsedModelUri} from "../../../src/utils/parseModelUri.js";
import {recommendedModels} from "../../../src/cli/recommendedModels.js";

describe("cli", () => {
    describe("recommended models", () => {
        test("all URIs resolve correctly", async () => {
            const unresolvedUris = (
                await Promise.all(
                    recommendedModels
                        .flatMap((modelOption) => (
                            modelOption.fileOptions.map(((uri) => [modelOption.name, uri]))
                        ))
                        .map(async ([modelName, uri]) => {
                            if (uri == null)
                                return null;

                            try {
                                await resolveParsedModelUri(parseModelUri(uri));
                                return null;
                            } catch (err) {
                                return {
                                    modelName,
                                    uri
                                };
                            }
                        })
                )
            )
                .filter((unresolvedUri) => unresolvedUri != null);

            expect(unresolvedUris).to.eql([]);
        });
    });
});

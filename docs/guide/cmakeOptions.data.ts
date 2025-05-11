import path from "path";
import fs from "fs-extra";
import {llamaCppDirectory} from "../../src/config.js";
import {parseCmakeListsTxtOptions} from "../../.vitepress/utils/parseCmakeListsTxtOptions.js";
import {buildHtmlTable} from "../../.vitepress/utils/buildHtmlTable.js";
import {htmlEscape} from "../../.vitepress/utils/htmlEscape.js";
import {getBinariesGithubRelease} from "../../src/bindings/utils/binariesGithubRelease.js";
import {getClonedLlamaCppRepoReleaseInfo} from "../../src/bindings/utils/cloneLlamaCppRepo.js";
import {htmlEscapeWithCodeMarkdown} from "../../.vitepress/utils/htmlEscapeWithCodeMarkdown.js";

const cmakeListsTxtFilePath = path.join(llamaCppDirectory, "ggml", "CMakeLists.txt");

const loader = {
    async load() {
        const cmakeListsTxt = await fs.readFile(cmakeListsTxtFilePath, "utf8");
        const clonedRepoReleaseInfo = await getClonedLlamaCppRepoReleaseInfo();
        const release = clonedRepoReleaseInfo?.tag ?? await getBinariesGithubRelease();

        const githubFileUrl = `https://github.com/ggml-org/llama.cpp/blob/${encodeURIComponent(release)}/ggml/CMakeLists.txt`;

        return {
            cmakeOptionsFileUrl: githubFileUrl,
            cmakeOptionsTable: renderCmakeOptionsTable(parseCmakeOptions(cmakeListsTxt), githubFileUrl),
            cudaCmakeOptionsTable: renderCmakeOptionsTable(
                parseCmakeOptions(cmakeListsTxt, (key) => (
                    key !== "GGML_CUDA" && key.toLowerCase().includes("cuda")
                )),
                githubFileUrl
            )
        } as const;
    }
} as const;

export default loader;

// purely for type checking
export const data: Awaited<ReturnType<(typeof loader)["load"]>> = undefined as any;


function renderCmakeOptionsTable(cmakeOptions: ReturnType<typeof parseCmakeOptions>, githubFileUrl: string) {
    return buildHtmlTable(
        [
            "Option",
            "Description",
            "Default value"
        ].map(htmlEscape),
        cmakeOptions.map((option) => {
            let url = githubFileUrl + "#L" + option.lineNumber;

            if (option.totalLines > 1)
                url += "-L" + (option.lineNumber + option.totalLines - 1);

            return [
                `<a href=${JSON.stringify(url)}>` +
                "" + `<code style="white-space: nowrap">${htmlEscape(option.key)}</code>` +
                "</a>",

                htmlEscape(option.description ?? ""),
                option.defaultValue ?? ""
            ];
        })
    );
}

function parseCmakeOptions(cmakeListsTxt: string, optionFilter: ((key: string) => boolean) = (() => true)) {
    const cmakeOptions = parseCmakeListsTxtOptions(cmakeListsTxt);

    for (let i = 0; i < cmakeOptions.length; i++) {
        const option = cmakeOptions[i]!;

        if (!optionFilter(option.key) || option.key === "GGML_LLAMAFILE" || option.key === "GGML_CURL" || option.key === "GGML_RPC" ||
            option.key === "GGML_WASM_SINGLE_FILE" || option.key === "BUILD_SHARED_LIBS" || option.key === "GGML_BACKEND_DL"
        ) {
            cmakeOptions.splice(i, 1);
            i--;
            continue;
        } else if (option.key === "GGML_METAL" && option.defaultValue === "${GGML_METAL_DEFAULT}")
            option.defaultValue = htmlEscapeWithCodeMarkdown("`ON` on macOS on Apple Silicon, `OFF` otherwise");
        else if (option.key === "GGML_BLAS" && option.defaultValue === "${GGML_BLAS_DEFAULT}")
            option.defaultValue = htmlEscapeWithCodeMarkdown("`ON` on macOS, `OFF` otherwise");
        else if (option.key === "GGML_METAL_EMBED_LIBRARY" && option.defaultValue === "${GGML_METAL}")
            option.defaultValue = htmlEscapeWithCodeMarkdown("`ON` on macOS, `OFF` otherwise");
        else if (option.defaultValue === "${GGML_STANDALONE}") {
            option.defaultValue = htmlEscapeWithCodeMarkdown("`OFF`");

            if (option.key === "GGML_BUILD_TESTS" || option.key === "GGML_BUILD_EXAMPLES") {
                cmakeOptions.splice(i, 1);
                i--;
                continue;
            }
        } else if (option.defaultValue === "${BUILD_SHARED_LIBS_DEFAULT}")
            option.defaultValue = htmlEscapeWithCodeMarkdown("`OFF` on MinGW, `ON` otherwise");
        else if (option.defaultValue === "${GGML_CUDA_GRAPHS_DEFAULT}")
            option.defaultValue = htmlEscapeWithCodeMarkdown("`ON`");
        else if (option.defaultValue === "${GGML_NATIVE_DEFAULT}")
            option.defaultValue = htmlEscapeWithCodeMarkdown("`OFF` when building for a different architecture,\n`ON` otherwise");
        else if (option.key === "LLAMA_CURL")
            option.defaultValue = htmlEscapeWithCodeMarkdown("`OFF`");
        else
            option.defaultValue = htmlEscapeWithCodeMarkdown(
                option.defaultValue != null
                    ? ("`" + option.defaultValue + "`")
                    : ""
            );
    }

    return cmakeOptions;
}

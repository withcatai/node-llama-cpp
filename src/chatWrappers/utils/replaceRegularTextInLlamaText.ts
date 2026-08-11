import {LlamaText} from "../../utils/LlamaText.js";

export function replaceRegularTextInLlamaText(text: string | LlamaText, find: string, replace: string) {
    return LlamaText(text)
        .mapValues((value) => {
            if (typeof value !== "string")
                return value;

            return value.replaceAll(find, replace);
        });
}

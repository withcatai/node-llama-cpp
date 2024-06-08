import {parseTextTemplate} from "../../../utils/parseTextTemplate.js";
import {ChatWrapperSettings} from "../../../types.js";

export function parseFunctionCallMessageTemplate(
    template?: ChatHistoryFunctionCallMessageTemplate
): ChatWrapperSettings["functions"] | null {
    if (template == null)
        return null;

    const {
        call: functionCallTemplate,
        result: functionCallResultTemplate
    } = template;

    if (functionCallTemplate == null || functionCallResultTemplate == null)
        throw new Error("Both function call and function call result templates are required");

    const parsedFunctionCallTemplate = parseTextTemplate(functionCallTemplate, [{
        text: "{{functionName}}",
        key: "functionName"
    }, {
        text: "{{functionParams}}",
        key: "functionParams"
    }]);
    const parsedFunctionCallResultTemplate = parseTextTemplate(functionCallResultTemplate, [{
        text: "{{functionCallResult}}",
        key: "functionCallResult"
    }]);

    const callPrefix = parsedFunctionCallTemplate.functionName.prefix;
    const callParamsPrefix = parsedFunctionCallTemplate.functionParams.prefix;
    const callSuffix = parsedFunctionCallTemplate.functionParams.suffix;

    const resultPrefix = parsedFunctionCallResultTemplate.functionCallResult.prefix;
    const resultSuffix = parsedFunctionCallResultTemplate.functionCallResult.suffix;

    if (callPrefix.length === 0)
        throw new Error("Function call template must have text before \"{{functionName}}\"");

    if (callSuffix.length === 0)
        throw new Error("Function call template must have text after \"{{functionParams}}\"");

    if (resultPrefix.length === 0)
        throw new Error("Function call result template must have text before \"{{functionCallResult}}\"");

    if (resultSuffix.length === 0)
        throw new Error("Function call result template must have text after \"{{functionCallResult}}\"");

    return {
        call: {
            optionalPrefixSpace: true,
            prefix: callPrefix,
            paramsPrefix: callParamsPrefix,
            suffix: callSuffix
        },
        result: {
            prefix: resultPrefix,
            suffix: resultSuffix
        }
    };
}

/**
 * Template format for how functions can be called by the model and how their results are fed to the model after the function call.
 * Consists of an array with two elements:
 * 1. The function call template.
 * 2. The function call result template.
 *
 * For example:
 * ```typescript
 * const template: ChatHistoryFunctionCallMessageTemplate = {
 *     call: "[[call: {{functionName}}({{functionParams}})]]",
 *     result: " [[result: {{functionCallResult}}]]"
 * };
 * ```
 *
 * It's mandatory for the call template to have text before <span v-pre>`{{functionName}}`</span> in order for the chat wrapper know when
 * to activate the function calling grammar.
 */
export type ChatHistoryFunctionCallMessageTemplate = {
    call: `${string}{{functionName}}${string}{{functionParams}}${string}`,
    result: `${string}{{functionCallResult}}${string}`
};

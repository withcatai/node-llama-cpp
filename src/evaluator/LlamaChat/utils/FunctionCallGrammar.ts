import {LlamaGrammar} from "../../LlamaGrammar.js";
import {LlamaText} from "../../../utils/LlamaText.js";
import {validateObjectAgainstGbnfSchema} from "../../../utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {ChatModelFunctions} from "../../../types.js";
import {GbnfGrammarGenerator} from "../../../utils/gbnfJson/GbnfGrammarGenerator.js";
import {getGbnfJsonTerminalForGbnfJsonSchema} from "../../../utils/gbnfJson/utils/getGbnfJsonTerminalForGbnfJsonSchema.js";
import {ChatWrapper} from "../../../ChatWrapper.js";
import {GbnfGrammar} from "../../../utils/gbnfJson/terminals/GbnfGrammar.js";
import {GbnfTerminal} from "../../../utils/gbnfJson/GbnfTerminal.js";
import {GbnfOr} from "../../../utils/gbnfJson/terminals/GbnfOr.js";
import {LlamaChatResponseFunctionCall} from "../LlamaChat.js";
import {GbnfVerbatimText} from "../../../utils/gbnfJson/terminals/GbnfVerbatimText.js";
import {Llama} from "../../../bindings/Llama.js";


export class FunctionCallGrammar<const Functions extends ChatModelFunctions> extends LlamaGrammar {
    private readonly _functions: Functions;
    private readonly _chatWrapper: ChatWrapper;

    public constructor(llama: Llama, functions: Functions, chatWrapper: ChatWrapper, initialFunctionCallEngaged: boolean) {
        const grammar = getGbnfGrammarForFunctionCalls(functions, chatWrapper, initialFunctionCallEngaged);

        super({
            llama,
            grammar,
            stopGenerationTriggers: [LlamaText(chatWrapper.settings.functions.call.suffix, "\n".repeat(4))],
            trimWhitespaceSuffix: true
        });

        this._functions = functions;
        this._chatWrapper = chatWrapper;

        this._validateFunctions();
    }

    public parseFunctionCall(callText: string): LlamaChatResponseFunctionCall<Functions> {
        if (this._chatWrapper.settings.functions.call.optionalPrefixSpace &&
            !callText.startsWith(this._chatWrapper.settings.functions.call.prefix) && callText[0] === " "
        )
            callText = callText.slice(1);

        if (!callText.startsWith(this._chatWrapper.settings.functions.call.prefix))
            throw new LlamaFunctionCallValidationError(
                `Expected function call to start with function call prefix from "${this._chatWrapper.wrapperName}" chat wrapper`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const paramsPrefixIndex = callText.indexOf(
            this._chatWrapper.settings.functions.call.paramsPrefix,
            this._chatWrapper.settings.functions.call.prefix.length
        );

        if (paramsPrefixIndex < 0)
            throw new LlamaFunctionCallValidationError(
                `Expected function call to contain params prefix from "${this._chatWrapper.wrapperName}" chat wrapper`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const functionName = callText.slice(
            this._chatWrapper.settings.functions.call.prefix.length,
            paramsPrefixIndex
        ) as keyof Functions & string;

        if (!Object.hasOwn(this._functions, functionName))
            throw new LlamaFunctionCallValidationError(
                `Function name "${functionName}" is not in the supplied functions object`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const functionSchema = this._functions[functionName];

        const callSuffix = this._chatWrapper.settings.functions.call.suffix;
        const callSuffixIndex = (callText + "\n".repeat(4)).lastIndexOf(callSuffix + "\n".repeat(4));

        if (callSuffixIndex < 0 || callSuffixIndex < paramsPrefixIndex + this._chatWrapper.settings.functions.call.paramsPrefix.length)
            throw new LlamaFunctionCallValidationError(
                `Expected function call to end with function call suffix from "${this._chatWrapper.wrapperName}" chat wrapper`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const paramsString = callText.slice(
            paramsPrefixIndex + this._chatWrapper.settings.functions.call.paramsPrefix.length,
            callSuffixIndex
        );

        if (functionSchema.params == null && paramsString.trim().length !== 0)
            throw new LlamaFunctionCallValidationError(
                `Expected function call to not contain params string but got "${paramsString}"`,
                this._functions,
                this._chatWrapper,
                callText
            );
        else if (functionSchema.params == null)
            return {
                functionName,
                params: undefined as any,
                raw: callText.slice(0, callSuffixIndex + callSuffix.length)
            };

        const params = JSON.parse(paramsString);

        validateObjectAgainstGbnfSchema(params, functionSchema.params);

        return {
            functionName,
            params: params as any, // prevent infinite TS type instantiation
            raw: callText.slice(0, callSuffixIndex + callSuffix.length)
        };
    }

    public parseFunctionNameFromPartialCall(callText: string, {
        enableInternalBuiltinFunctions = false,
        initialFunctionCallEngaged = false
    }: {
        enableInternalBuiltinFunctions?: boolean,
        initialFunctionCallEngaged?: boolean
    } = {}): keyof Functions & string {
        if (this._chatWrapper.settings.functions.call.optionalPrefixSpace &&
            !callText.startsWith(this._chatWrapper.settings.functions.call.prefix) && callText[0] === " "
        )
            callText = callText.slice(1);

        if (!callText.startsWith(this._chatWrapper.settings.functions.call.prefix))
            throw new LlamaFunctionCallValidationError(
                `Expected function call to start with function call prefix from "${this._chatWrapper.wrapperName}" chat wrapper`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const paramsPrefixIndex = callText.indexOf(
            this._chatWrapper.settings.functions.call.paramsPrefix,
            this._chatWrapper.settings.functions.call.prefix.length
        );

        if (paramsPrefixIndex < 0)
            throw new LlamaFunctionCallValidationError(
                `Expected function call to contain params prefix from "${this._chatWrapper.wrapperName}" chat wrapper`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const functionName = callText.slice(
            this._chatWrapper.settings.functions.call.prefix.length,
            paramsPrefixIndex
        ) as keyof Functions & string;

        let foundFunctionName = Object.hasOwn(this._functions, functionName);

        if (!foundFunctionName && enableInternalBuiltinFunctions)
            foundFunctionName ||= Object.hasOwn(
                this._chatWrapper.getInternalBuiltinFunctions({initialFunctionCallEngaged}),
                functionName
            );

        if (!foundFunctionName)
            throw new LlamaFunctionCallValidationError(
                `Function name "${functionName}" is not in the supplied functions object`,
                this._functions,
                this._chatWrapper,
                callText
            );

        return functionName;
    }

    private _validateFunctions() {
        for (const functionsName of Object.keys(this._functions)) {
            if (functionsName.includes(" ") || functionsName.includes("\n") || functionsName.includes("\t"))
                throw new Error(`Function name "${functionsName}" contains spaces, new lines or tabs`);
        }
    }
}

function getGbnfGrammarForFunctionCalls<const Functions extends ChatModelFunctions>(
    functions: Functions, chatWrapper: ChatWrapper, initialFunctionCallEngaged: boolean
): string {
    const grammarGenerator = new GbnfGrammarGenerator();

    const callGrammars: GbnfTerminal[] = [];

    function addFunctionCallGrammar(functionName: string, functionSchema: ChatModelFunctions[string]) {
        if (functionSchema.params != null) {
            const paramsTerminal = getGbnfJsonTerminalForGbnfJsonSchema(functionSchema.params, grammarGenerator);

            callGrammars.push(
                new GbnfGrammar([
                    new GbnfVerbatimText(functionName + chatWrapper.settings.functions.call.paramsPrefix).getGrammar(),
                    paramsTerminal.resolve(grammarGenerator)
                ])
            );
        } else
            callGrammars.push(new GbnfVerbatimText(functionName + chatWrapper.settings.functions.call.paramsPrefix));
    }

    for (const [functionName, functionSchema] of Object.entries(functions))
        addFunctionCallGrammar(functionName, functionSchema);

    for (const [functionName, functionSchema] of Object.entries(chatWrapper.getInternalBuiltinFunctions({initialFunctionCallEngaged})))
        addFunctionCallGrammar(functionName, functionSchema);

    const callGrammar = new GbnfOr(callGrammars);

    const rootTerminal = new GbnfGrammar([
        ...(chatWrapper.settings.functions.call.optionalPrefixSpace ? ["[ ]?"] : []),
        new GbnfVerbatimText(chatWrapper.settings.functions.call.prefix).getGrammar(),
        callGrammar.resolve(grammarGenerator),
        new GbnfVerbatimText(chatWrapper.settings.functions.call.suffix).getGrammar()
    ]);

    const rootGrammar = rootTerminal.getGrammar();

    return grammarGenerator.generateGbnfFile(rootGrammar + " [\\n]".repeat(4) + " [\\n]*");
}

export class LlamaFunctionCallValidationError<const Functions extends ChatModelFunctions> extends Error {
    public readonly functions: Functions;
    public readonly chatWrapper: ChatWrapper;
    public readonly callText: string;

    public constructor(message: string, functions: Functions, chatWrapper: ChatWrapper, callText: string) {
        super(message);

        this.functions = functions;
        this.chatWrapper = chatWrapper;
        this.callText = callText;
    }
}

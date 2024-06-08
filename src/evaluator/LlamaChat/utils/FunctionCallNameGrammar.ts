import {LlamaGrammar} from "../../LlamaGrammar.js";
import {LlamaText} from "../../../utils/LlamaText.js";
import {ChatModelFunctions} from "../../../types.js";
import {GbnfGrammarGenerator} from "../../../utils/gbnfJson/GbnfGrammarGenerator.js";
import {ChatWrapper} from "../../../ChatWrapper.js";
import {GbnfGrammar} from "../../../utils/gbnfJson/terminals/GbnfGrammar.js";
import {GbnfTerminal} from "../../../utils/gbnfJson/GbnfTerminal.js";
import {GbnfOr} from "../../../utils/gbnfJson/terminals/GbnfOr.js";
import {GbnfVerbatimText} from "../../../utils/gbnfJson/terminals/GbnfVerbatimText.js";
import {Llama} from "../../../bindings/Llama.js";
import {LlamaFunctionCallValidationError} from "./LlamaFunctionCallValidationError.js";


export class FunctionCallNameGrammar<const Functions extends ChatModelFunctions> extends LlamaGrammar {
    private readonly _functions: Functions;
    private readonly _chatWrapper: ChatWrapper;

    public constructor(llama: Llama, functions: Functions, chatWrapper: ChatWrapper) {
        const grammar = getGbnfGrammarForFunctionName(functions, chatWrapper);

        super(llama, {
            grammar,
            stopGenerationTriggers: [LlamaText("\n")],
            trimWhitespaceSuffix: true
        });

        this._functions = functions;
        this._chatWrapper = chatWrapper;

        this._validateFunctions();
    }

    public parseFunctionName(generatedFunctionName: string): keyof Functions & string {
        if (this._chatWrapper.settings.functions.call.optionalPrefixSpace && generatedFunctionName[0] === " ")
            generatedFunctionName = generatedFunctionName.slice(1);

        const newlineIndex = generatedFunctionName.indexOf("\n");

        const functionName = generatedFunctionName.slice(
            0,
            newlineIndex < 0
                ? generatedFunctionName.length
                : newlineIndex
        ) as keyof Functions & string;

        if (!Object.hasOwn(this._functions, functionName))
            throw new LlamaFunctionCallValidationError(
                `Function name "${functionName}" is not in the supplied functions object`,
                this._functions,
                this._chatWrapper,
                generatedFunctionName
            );

        return functionName;
    }

    private _validateFunctions() {
        for (const functionsName of Object.keys(this._functions)) {
            if (functionsName.includes(" ") || functionsName.includes("\n") || functionsName.includes("\t"))
                throw new Error(`Function name "${functionsName}" contains spaces, new lines or tabs`);
            else if (functionsName === "")
                throw new Error("Function name cannot be an empty string");
        }
    }
}

function getGbnfGrammarForFunctionName<const Functions extends ChatModelFunctions>(
    functions: Functions, chatWrapper: ChatWrapper
): string {
    const grammarGenerator = new GbnfGrammarGenerator();

    const functionNameGrammars: GbnfTerminal[] = [];

    for (const functionName of Object.keys(functions))
        functionNameGrammars.push(new GbnfVerbatimText(functionName));

    const callGrammar = new GbnfOr(functionNameGrammars);

    const rootTerminal = new GbnfGrammar([
        ...(chatWrapper.settings.functions.call.optionalPrefixSpace ? ["[ ]?"] : []),
        callGrammar.resolve(grammarGenerator)
    ]);

    const rootGrammar = rootTerminal.getGrammar();

    return grammarGenerator.generateGbnfFile(rootGrammar + " [\\n]");
}

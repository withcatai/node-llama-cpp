import {LlamaGrammar} from "../../LlamaGrammar.js";
import {LlamaText} from "../../../utils/LlamaText.js";
import {validateObjectAgainstGbnfSchema} from "../../../utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {ChatModelFunctions} from "../../../types.js";
import {GbnfGrammarGenerator} from "../../../utils/gbnfJson/GbnfGrammarGenerator.js";
import {getGbnfJsonTerminalForGbnfJsonSchema} from "../../../utils/gbnfJson/utils/getGbnfJsonTerminalForGbnfJsonSchema.js";
import {ChatWrapper} from "../../../ChatWrapper.js";
import {Llama} from "../../../bindings/Llama.js";
import {GbnfJsonSchema} from "../../../utils/gbnfJson/types.js";
import {LlamaFunctionCallValidationError} from "./LlamaFunctionCallValidationError.js";


export class FunctionCallParamsGrammar<const Functions extends ChatModelFunctions> extends LlamaGrammar {
    private readonly _functions: Functions;
    private readonly _chatWrapper: ChatWrapper;
    private readonly _functionName: string;
    private readonly _paramsSchema: GbnfJsonSchema;

    public constructor(llama: Llama, functions: Functions, chatWrapper: ChatWrapper, functionName: string, paramsSchema: GbnfJsonSchema) {
        const grammar = getGbnfGrammarForFunctionParams(paramsSchema);

        super(llama, {
            grammar,
            stopGenerationTriggers: [LlamaText("\n".repeat(4))],
            trimWhitespaceSuffix: true
        });

        this._functions = functions;
        this._chatWrapper = chatWrapper;
        this._functionName = functionName;
        this._paramsSchema = paramsSchema;
    }

    public parseParams(callText: string) {
        const endIndex = callText.lastIndexOf("\n".repeat(4));

        if (endIndex < 0)
            throw new LlamaFunctionCallValidationError(
                `Expected function call params for function "${this._functionName}" to end with stop generation trigger`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const paramsString = callText.slice(0, endIndex);

        if (paramsString.trim().length === 0)
            throw new LlamaFunctionCallValidationError(
                `Expected function call params for function "${this._functionName}" to not be empty`,
                this._functions,
                this._chatWrapper,
                callText
            );

        const params = JSON.parse(paramsString);

        validateObjectAgainstGbnfSchema(params, this._paramsSchema);

        return {
            params: params as any, // prevent infinite TS type instantiation
            raw: paramsString
        };
    }
}

function getGbnfGrammarForFunctionParams(paramsSchema: GbnfJsonSchema): string {
    const grammarGenerator = new GbnfGrammarGenerator();
    const rootTerminal = getGbnfJsonTerminalForGbnfJsonSchema(paramsSchema, grammarGenerator);
    const rootGrammar = rootTerminal.getGrammar(grammarGenerator);

    return grammarGenerator.generateGbnfFile(rootGrammar + ` "${"\\n".repeat(4)}"`);
}

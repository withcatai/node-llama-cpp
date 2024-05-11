import {GbnfJsonSchema, GbnfJsonSchemaToType} from "../utils/gbnfJson/types.js";
import {getGbnfGrammarForGbnfJsonSchema} from "../utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js";
import {validateObjectAgainstGbnfSchema} from "../utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {LlamaText} from "../utils/LlamaText.js";
import {Llama} from "../bindings/Llama.js";
import {LlamaGrammar} from "./LlamaGrammar.js";

export class LlamaJsonSchemaGrammar<const T extends Readonly<GbnfJsonSchema>> extends LlamaGrammar {
    private readonly _schema: T;

    public constructor(llama: Llama, schema: T) {
        const grammar = getGbnfGrammarForGbnfJsonSchema(schema);

        super(llama, {
            grammar,
            stopGenerationTriggers: [LlamaText(["\n".repeat(4)])],
            trimWhitespaceSuffix: true
        });

        this._schema = schema;
    }

    public parse(json: string): GbnfJsonSchemaToType<T> {
        const parsedJson = JSON.parse(json);

        validateObjectAgainstGbnfSchema(parsedJson, this._schema);

        return parsedJson;
    }
}

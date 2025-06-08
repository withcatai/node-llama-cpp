import {GbnfJsonDefList, GbnfJsonSchema, GbnfJsonSchemaToType} from "../utils/gbnfJson/types.js";
import {getGbnfGrammarForGbnfJsonSchema} from "../utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js";
import {validateObjectAgainstGbnfSchema} from "../utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import {LlamaText} from "../utils/LlamaText.js";
import {Llama} from "../bindings/Llama.js";
import {LlamaGrammar} from "./LlamaGrammar.js";

/* eslint-disable @stylistic/max-len */
/**
 * @see [Using a JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#json-schema) tutorial
 * @see [Reducing Hallucinations When Using JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#reducing-json-schema-hallucinations) tutorial
 */
export class LlamaJsonSchemaGrammar<
    const T extends GbnfJsonSchema<Defs>,
    const Defs extends GbnfJsonDefList<Defs> = Record<any, any>
> extends LlamaGrammar {
    private readonly _schema: T;

    /**
     * Prefer to create a new instance of this class by using `llama.createGrammarForJsonSchema(...)`.
     * @deprecated Use `llama.createGrammarForJsonSchema(...)` instead.
     */
    public constructor(llama: Llama, schema: Readonly<T> & GbnfJsonSchema<Defs>) {
        const grammar = getGbnfGrammarForGbnfJsonSchema(schema);

        super(llama, {
            grammar,
            stopGenerationTriggers: [LlamaText(["\n".repeat(4)])],
            trimWhitespaceSuffix: true
        });

        this._schema = schema;
    }

    public get schema(): Readonly<T> {
        return this._schema;
    }

    public parse(json: string): GbnfJsonSchemaToType<T> {
        const parsedJson = JSON.parse(json);

        validateObjectAgainstGbnfSchema(parsedJson, this._schema);

        return parsedJson;
    }
}
/* eslint-enable @stylistic/max-len */

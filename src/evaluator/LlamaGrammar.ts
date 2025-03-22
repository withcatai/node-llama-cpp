import path from "path";
import fs from "fs-extra";
import {getGrammarsFolder} from "../utils/getGrammarsFolder.js";
import {LlamaText} from "../utils/LlamaText.js";
import {AddonGrammar} from "../bindings/AddonTypes.js";
import {Llama} from "../bindings/Llama.js";
import {Token} from "../types.js";


export type LlamaGrammarOptions = {
    /** GBNF grammar */
    grammar: string,

    /** Consider any of these as EOS for the generated text. Only supported by `LlamaChat` and `LlamaChatSession` */
    stopGenerationTriggers?: readonly (LlamaText | string | readonly (string | Token)[])[],

    /** Trim whitespace from the end of the generated text. Only supported by `LlamaChat` and `LlamaChatSession` */
    trimWhitespaceSuffix?: boolean,

    /**
     * Root rule name.
     *
     * Defaults to `"root"`.
     */
    rootRuleName?: string
};

/**
 * @see [Using Grammar](https://node-llama-cpp.withcat.ai/guide/grammar) tutorial
 */
export class LlamaGrammar {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _grammar: AddonGrammar;
    /** @internal */ private readonly _stopGenerationTriggers: readonly (LlamaText | string | readonly (string | Token)[])[];
    /** @internal */ private readonly _trimWhitespaceSuffix: boolean;
    /** @internal */ private readonly _grammarText: string;
    /** @internal */ private readonly _rootRuleName: string;

    /**
     * > GBNF files are supported.
     * > More info here: [
     * github:ggml-org/llama.cpp:grammars/README.md
     * ](https://github.com/ggml-org/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md)
     *
     * Prefer to create a new instance of this class by using `llama.createGrammar(...)`.
     * @deprecated Use `llama.createGrammar(...)` instead.
     * @param llama
     * @param options
     */
    public constructor(llama: Llama, {
        grammar, stopGenerationTriggers = [], trimWhitespaceSuffix = false, rootRuleName = "root"
    }: LlamaGrammarOptions) {
        this._llama = llama;
        this._grammar = new this._llama._bindings.AddonGrammar(grammar, {
            addonExports: this._llama._bindings,
            rootRuleName
        });
        this._stopGenerationTriggers = stopGenerationTriggers ?? [];
        this._trimWhitespaceSuffix = trimWhitespaceSuffix;
        this._grammarText = grammar;
        this._rootRuleName = rootRuleName;
    }

    public get grammar(): string {
        return this._grammarText;
    }

    public get rootRuleName(): string {
        return this._rootRuleName;
    }

    public get stopGenerationTriggers() {
        return this._stopGenerationTriggers;
    }

    public get trimWhitespaceSuffix() {
        return this._trimWhitespaceSuffix;
    }

    /**
     * Test if the given text is compatible with the grammar.
     * @internal
     */
    public _testText(text: string): boolean {
        return this._grammar.isTextCompatible(String(text));
    }

    public static async getFor(llama: Llama, type: "json" | "json_arr" | "english" | "list" | "c" | "arithmetic" | "japanese" | "chess") {
        const grammarsFolder = await getGrammarsFolder(llama.buildType);

        const grammarFile = path.join(grammarsFolder, type + ".gbnf");

        if (await fs.pathExists(grammarFile)) {
            const grammar = await fs.readFile(grammarFile, "utf8");
            return new LlamaGrammar(llama, {
                grammar,
                stopGenerationTriggers: [LlamaText(["\n".repeat(
                    (type === "json" || type === "json_arr")
                        ? 4
                        : 10
                )])], // this is a workaround for the model not stopping to generate text,
                trimWhitespaceSuffix: true
            });
        }

        throw new Error(`Grammar file for type "${type}" was not found in "${grammarsFolder}"`);
    }
}

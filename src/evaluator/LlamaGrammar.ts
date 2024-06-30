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

    /** print the grammar to stdout */
    printGrammar?: boolean,

    /** Consider any of these as EOS for the generated text. Only supported by `LlamaChat` and `LlamaChatSession` */
    stopGenerationTriggers?: readonly (LlamaText | string | readonly (string | Token)[])[],

    /** Trim whitespace from the end of the generated text. Only supported by `LlamaChat` and `LlamaChatSession` */
    trimWhitespaceSuffix?: boolean
};

export class LlamaGrammar {
    /** @internal */ public readonly _llama: Llama;
    /** @internal */ public readonly _grammar: AddonGrammar;
    private readonly _stopGenerationTriggers: readonly (LlamaText | string | readonly (string | Token)[])[];
    private readonly _trimWhitespaceSuffix: boolean;
    private readonly _grammarText: string;

    /**
     * > GBNF files are supported.
     * > More info here: [
     * github:ggerganov/llama.cpp:grammars/README.md
     * ](https://github.com/ggerganov/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md)
     * @param llama
     * @param options
     */
    public constructor(llama: Llama, {
        grammar, stopGenerationTriggers = [], trimWhitespaceSuffix = false, printGrammar = false
    }: LlamaGrammarOptions) {
        this._llama = llama;
        this._grammar = new this._llama._bindings.AddonGrammar(grammar, {
            addonExports: this._llama._bindings,
            printGrammar
        });
        this._stopGenerationTriggers = stopGenerationTriggers ?? [];
        this._trimWhitespaceSuffix = trimWhitespaceSuffix;
        this._grammarText = grammar;
    }

    public get grammar(): string {
        return this._grammarText;
    }

    public get stopGenerationTriggers() {
        return this._stopGenerationTriggers;
    }

    public get trimWhitespaceSuffix() {
        return this._trimWhitespaceSuffix;
    }

    public static async getFor(llama: Llama, type: "json" | "list" | "arithmetic" | "japanese" | "chess") {
        const grammarsFolder = await getGrammarsFolder(llama.buildType);

        const grammarFile = path.join(grammarsFolder, type + ".gbnf");

        if (await fs.pathExists(grammarFile)) {
            const grammar = await fs.readFile(grammarFile, "utf8");
            return new LlamaGrammar(llama, {
                grammar,
                stopGenerationTriggers: [LlamaText(["\n".repeat(10)])], // this is a workaround for the model not stopping to generate text,
                trimWhitespaceSuffix: true
            });
        }

        throw new Error(`Grammar file for type "${type}" was not found in "${grammarsFolder}"`);
    }
}

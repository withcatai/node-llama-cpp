import path from "path";
import fs from "fs-extra";
import {getGrammarsFolder} from "../utils/getGrammarsFolder.js";
import {LLAMAGrammar} from "./LlamaBins.js";


export type LlamaGrammarOptions = {
    /** GBNF grammar */
    grammar: string,

    /** print the grammar to stdout */
    printGrammar?: boolean

    /** Consider any of these texts as EOS for the generated out. Only supported by `LlamaChatSession` */
    stopStrings?: string[],

    /** Trim whitespace from the end of the generated text. Only supported by `LlamaChatSession` */
    trimWhitespaceSuffix?: boolean
};

export class LlamaGrammar {
    /** @internal */
    public readonly _grammar: LLAMAGrammar;
    private readonly _stopStrings: readonly string[];
    private readonly _trimWhitespaceSuffix: boolean;
    private readonly _grammarText: string;

    /**
     * > GBNF files are supported.
     * > More info here: [github:ggerganov/llama.cpp:grammars/README.md](
     * > https://github.com/ggerganov/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md)
     * @param {object} options
     * @param {string} options.grammar - GBNF grammar
     * @param {string[]} [options.stopStrings] - Consider any of these texts as EOS for the generated out.
     * Only supported by `LlamaChatSession`
     * @param {boolean} [options.trimWhitespaceSuffix] - Trim whitespace from the end of the generated text.
     * Only supported by `LlamaChatSession`
     * @param {boolean} [options.printGrammar] - print the grammar to stdout
     */
    public constructor({
        grammar, stopStrings = [], trimWhitespaceSuffix = false, printGrammar = false
    }: LlamaGrammarOptions) {
        this._grammar = new LLAMAGrammar(grammar, {
            printGrammar
        });
        this._stopStrings = stopStrings ?? [];
        this._trimWhitespaceSuffix = trimWhitespaceSuffix;
        this._grammarText = grammar;
    }

    public get grammar(): string {
        return this._grammarText;
    }

    public get stopStrings() {
        return this._stopStrings;
    }

    public get trimWhitespaceSuffix() {
        return this._trimWhitespaceSuffix;
    }

    public static async getFor(type: "json" | "list" | "arithmetic" | "japanese" | "chess") {
        const grammarsFolder = await getGrammarsFolder();

        const grammarFile = path.join(grammarsFolder, type + ".gbnf");

        if (await fs.pathExists(grammarFile)) {
            const grammar = await fs.readFile(grammarFile, "utf8");
            return new LlamaGrammar({
                grammar,
                stopStrings: ["\n".repeat(10)], // this is a workaround for the model not stopping to generate text,
                trimWhitespaceSuffix: true
            });
        }

        throw new Error(`Grammar file for type "${type}" was not found in "${grammarsFolder}"`);
    }
}

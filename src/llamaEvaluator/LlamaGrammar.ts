import path from "path";
import fs from "fs-extra";
import {getGrammarsFolder} from "../utils/getGrammarsFolder.js";
import {LLAMAGrammar} from "./LlamaBins.js";


export type LlamaGrammarOptions = {
    /** GBNF grammar */
    grammar: string,

    /** print the grammar to stdout */
    printGrammar?: boolean
};

export class LlamaGrammar {
    /** @internal */
    public readonly _grammar: LLAMAGrammar;

    /**
     * GBNF files are supported.
     * More info here: https://github.com/ggerganov/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md
     * @param {object} options
     * @param {string} options.grammar - GBNF grammar
     * @param {boolean} [options.printGrammar] - print the grammar to stdout
     */
    public constructor({grammar, printGrammar = false}: LlamaGrammarOptions) {
        this._grammar = new LLAMAGrammar(grammar, {
            printGrammar
        });
    }

    public static async getFor(type: "json" | "list" | "arithmetic" | "japanese" | "chess") {
        const grammarsFolder = await getGrammarsFolder();

        const grammarFile = path.join(grammarsFolder, type + ".gbnf");

        if (await fs.pathExists(grammarFile)) {
            const grammar = await fs.readFile(grammarFile, "utf8");
            return new LlamaGrammar({grammar});
        }

        throw new Error(`Grammar file for type "${type}" was not found in "${grammarsFolder}"`);
    }
}

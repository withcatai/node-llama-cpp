import {GbnfTerminal} from "../GbnfTerminal.js";


export class GbnfGrammar extends GbnfTerminal {
    public readonly grammar: string | string[];

    public constructor(grammar: string | string[]) {
        super();
        this.grammar = grammar;
    }

    public getGrammar(): string {
        if (this.grammar instanceof Array)
            return this.grammar
                .filter((item) => item !== "")
                .join(" ");

        return this.grammar;
    }
}

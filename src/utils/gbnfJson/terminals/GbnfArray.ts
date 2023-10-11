import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfWhitespace} from "./GbnfWhitespace.js";
import {GbnfGrammar} from "./GbnfGrammar.js";
import {GbnfOr} from "./GbnfOr.js";


export class GbnfArray extends GbnfTerminal {
    public readonly items: GbnfTerminal;

    public constructor(items: GbnfTerminal) {
        super();

        this.items = items;
    }

    getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const whitespaceRuleName = new GbnfWhitespace().resolve(grammarGenerator);
        const itemsGrammarRuleName = this.items.resolve(grammarGenerator);

        return new GbnfGrammar([
            '"["', whitespaceRuleName,
            new GbnfOr([
                new GbnfGrammar([
                    "(", itemsGrammarRuleName, ")",
                    "(", '","', whitespaceRuleName, itemsGrammarRuleName, ")*"
                ]),
                new GbnfGrammar([
                    "(", itemsGrammarRuleName, ")?"
                ])
            ]).getGrammar(grammarGenerator),
            whitespaceRuleName, '"]"'
        ]).getGrammar();
    }
}

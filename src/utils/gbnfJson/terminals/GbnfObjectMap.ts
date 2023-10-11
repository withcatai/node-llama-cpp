import {GbnfTerminal} from "../GbnfTerminal.js";
import {GbnfGrammarGenerator} from "../GbnfGrammarGenerator.js";
import {GbnfString} from "./GbnfString.js";
import {GbnfStringValue} from "./GbnfStringValue.js";
import {GbnfWhitespace} from "./GbnfWhitespace.js";
import {GbnfGrammar} from "./GbnfGrammar.js";


export class GbnfObjectMap extends GbnfTerminal {
    public readonly fields: Array<Readonly<{ key: GbnfString | GbnfStringValue, value: GbnfTerminal, required: true }>>;

    public constructor(fields: Array<Readonly<{ key: GbnfString | GbnfStringValue, value: GbnfTerminal, required: true }>>) {
        super();

        this.fields = fields;
    }

    getGrammar(grammarGenerator: GbnfGrammarGenerator): string {
        const whitespaceRuleName = new GbnfWhitespace().resolve(grammarGenerator);

        return new GbnfGrammar([
            '"{"', whitespaceRuleName,
            ...this.fields.map(({key, value}, index) => {
                return new GbnfGrammar([
                    key.getGrammar(), '":"', "[ ]?", value.resolve(grammarGenerator),
                    index < this.fields.length - 1 ? '","' : "",
                    whitespaceRuleName
                ]).getGrammar();
            }),
            '"}"'
        ]).getGrammar();
    }
}

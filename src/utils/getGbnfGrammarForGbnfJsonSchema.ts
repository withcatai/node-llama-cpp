import {GbnfJsonSchema} from "./gbnfJson/types.js";
import {getGbnfJsonTerminalForGbnfJsonSchema} from "./gbnfJson/utils/getGbnfJsonTerminalForGbnfJsonSchema.js";
import {GbnfGrammarGenerator} from "./gbnfJson/GbnfGrammarGenerator.js";


export function getGbnfGrammarForGbnfJsonSchema(schema: GbnfJsonSchema): string {
    const grammarGenerator = new GbnfGrammarGenerator();
    const rootTerminal = getGbnfJsonTerminalForGbnfJsonSchema(schema, grammarGenerator);
    const rootGrammar = rootTerminal.getGrammar(grammarGenerator);

    return grammarGenerator.generateGbnfFile(rootGrammar + " [\\n]".repeat(4) + " [\\n]*");
}

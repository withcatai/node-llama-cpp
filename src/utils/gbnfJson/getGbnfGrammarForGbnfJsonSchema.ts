import {GbnfJsonSchema} from "./types.js";
import {getGbnfJsonTerminalForGbnfJsonSchema} from "./utils/getGbnfJsonTerminalForGbnfJsonSchema.js";
import {GbnfGrammarGenerator} from "./GbnfGrammarGenerator.js";
import {GbnfJsonScopeState} from "./utils/GbnfJsonScopeState.js";


export function getGbnfGrammarForGbnfJsonSchema(schema: GbnfJsonSchema, {
    allowNewLines = true,
    scopePadSpaces = 4
}: {
    allowNewLines?: boolean,
    scopePadSpaces?: number
} = {}): string {
    const grammarGenerator = new GbnfGrammarGenerator();
    const scopeState = new GbnfJsonScopeState({allowNewLines, scopePadSpaces});
    const rootTerminal = getGbnfJsonTerminalForGbnfJsonSchema(schema, grammarGenerator, scopeState);
    const rootGrammar = rootTerminal.getGrammar(grammarGenerator);

    return grammarGenerator.generateGbnfFile(rootGrammar + ` "${"\\n".repeat(4)}"` + " [\\n]*");
}

import {MultiKeyMap} from "lifecycle-utils";
import {GbnfJsonSchema} from "../types.js";

export class DefScopeDefs {
    public defScopeDefs: MultiKeyMap<[string, GbnfJsonSchema], Record<string, GbnfJsonSchema>> = new MultiKeyMap();

    public registerDefs(scopeDefs: Record<string, GbnfJsonSchema>) {
        for (const [defName, def] of Object.entries(scopeDefs))
            this.defScopeDefs.set([defName, def], scopeDefs);
    }
}

export function joinDefs(
    parent: Record<string, GbnfJsonSchema>,
    current?: Record<string, GbnfJsonSchema>
) {
    if (current == null || Object.keys(current).length === 0)
        return parent;

    return {
        ...parent,
        ...current
    };
}

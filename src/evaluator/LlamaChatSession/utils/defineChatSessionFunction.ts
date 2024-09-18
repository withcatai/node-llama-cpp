import {GbnfJsonSchema, GbnfJsonSchemaToType} from "../../../utils/gbnfJson/types.js";
import {ChatSessionModelFunction} from "../../../types.js";

/**
 * Define a function that can be used by the model in a chat session, and return it.
 *
 * This is a helper function to facilitate defining functions with full TypeScript type information.
 * @param functionDefinition
 */
export function defineChatSessionFunction<const Params extends GbnfJsonSchema | undefined>({
    description,
    params,
    handler
}: {
    description?: string,
    params?: Params,
    handler: (params: GbnfJsonSchemaToType<Params>) => any
}): ChatSessionModelFunction<Params> {
    return {
        description,
        params,
        handler
    };
}

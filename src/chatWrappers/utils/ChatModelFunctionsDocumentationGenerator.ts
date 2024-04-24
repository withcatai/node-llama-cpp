import {ChatModelFunctions} from "../../types.js";
import {getTypeScriptTypeStringForGbnfJsonSchema} from "../../utils/getTypeScriptTypeStringForGbnfJsonSchema.js";

/**
 * Generate documentation about the functions that are available for a model to call.
 * Useful for generating a system message with information about the available functions as part of a chat wrapper.
 */
export class ChatModelFunctionsDocumentationGenerator {
    public readonly chatModelFunctions?: ChatModelFunctions;
    public readonly hasAnyFunctions: boolean;

    public constructor(chatModelFunctions: ChatModelFunctions | undefined) {
        this.chatModelFunctions = chatModelFunctions;
        this.hasAnyFunctions = Object.keys(this.chatModelFunctions ?? {}).length > 0;
    }

    /**
     * Example:
     * ```typescript
     * // Retrieve the current date
     * function getDate();
     *
     * // Retrieve the current time
     * function getTime(params: {hours: "24" | "12", seconds: boolean});
     * ```
     * @param options
     * @param [options.documentParams] - Whether to document the parameters of the functions
     */
    public getTypeScriptFunctionSignatures({documentParams = true}: {documentParams?: boolean} = {}) {
        const chatModelFunctions = this.chatModelFunctions;

        if (!this.hasAnyFunctions || chatModelFunctions == null)
            return "";

        const functionNames = Object.keys(chatModelFunctions);

        return functionNames
            .map((functionName) => {
                const functionDefinition = chatModelFunctions[functionName];
                let res = "";

                if (functionDefinition?.description != null && functionDefinition.description.trim() !== "")
                    res += "// " + functionDefinition.description.split("\n").join("\n// ") + "\n";

                res += "function " + functionName + "(";

                if (documentParams && functionDefinition?.params != null)
                    res += "params: " + getTypeScriptTypeStringForGbnfJsonSchema(functionDefinition.params);
                else if (!documentParams && functionDefinition?.params != null)
                    res += "params";

                res += ");";

                return res;
            })
            .join("\n\n");
    }

    /**
     * Example:
     * ```typescript
     * // Retrieve the current date
     * type getDate = () => any;
     *
     * // Retrieve the current time
     * type getTime = (_: {hours: "24" | "12", seconds: boolean}) => any;
     * ```
     * @param options
     * @param [options.documentParams] - Whether to document the parameters of the functions
     * @param [options.reservedFunctionNames] - Function names that are reserved and cannot be used
     */
    public getTypeScriptFunctionTypes({documentParams = true, reservedFunctionNames = []}: {
        documentParams?: boolean, reservedFunctionNames?: string[]
    } = {}) {
        const chatModelFunctions = this.chatModelFunctions;

        if (!this.hasAnyFunctions || chatModelFunctions == null)
            return "";

        const functionNames = Object.keys(chatModelFunctions);
        const reservedFunctionNamesSet = new Set(reservedFunctionNames);

        return functionNames
            .map((functionName) => {
                if (reservedFunctionNamesSet.has(functionName))
                    throw new Error(`Function name "${functionName}" is reserved and cannot be used`);

                const functionDefinition = chatModelFunctions[functionName];
                let res = "";

                if (functionDefinition?.description != null && functionDefinition.description.trim() !== "")
                    res += "// " + functionDefinition.description.split("\n").join("\n// ") + "\n";

                res += "type " + functionName + " = (";

                if (documentParams && functionDefinition?.params != null)
                    res += "_: " + getTypeScriptTypeStringForGbnfJsonSchema(functionDefinition.params);

                res += ") => any;";

                return res;
            })
            .join("\n\n");
    }
}

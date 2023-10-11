import {GbnfNull} from "../terminals/GbnfNull.js";
import {GbnfBooleanValue} from "../terminals/GbnfBooleanValue.js";
import {GbnfNumberValue} from "../terminals/GbnfNumberValue.js";
import {GbnfStringValue} from "../terminals/GbnfStringValue.js";


export function getGbnfJsonTerminalForLiteral(literal: string | number | boolean | null) {
    if (literal === null)
        return new GbnfNull();

    if (typeof literal === "boolean")
        return new GbnfBooleanValue(literal);

    if (typeof literal === "number")
        return new GbnfNumberValue(literal);

    if (typeof literal === "string")
        return new GbnfStringValue(literal);

    throw new Error(`Unrecognized literal type: ${typeof literal}`);
}

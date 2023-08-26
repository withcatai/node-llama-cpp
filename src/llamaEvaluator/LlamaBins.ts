import {loadBin, type LLAMAModel, type LLAMAContext, type LLAMAGrammar} from "../utils/getBin.js";

export const llamaCppNode = await loadBin();
const {LLAMAModel, LLAMAContext, LLAMAGrammar} = llamaCppNode;

export {LLAMAModel, LLAMAContext, LLAMAGrammar};

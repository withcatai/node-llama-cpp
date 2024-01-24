import {loadBin, type LLAMAModel, type LLAMAContext, type LLAMAGrammar, type LLAMAGrammarEvaluationState} from "../utils/getBin.js";

export const llamaCppNode = await loadBin();
const {LLAMAModel, LLAMAContext, LLAMAGrammar, LLAMAGrammarEvaluationState} = llamaCppNode;

export {LLAMAModel, LLAMAContext, LLAMAGrammar, LLAMAGrammarEvaluationState};

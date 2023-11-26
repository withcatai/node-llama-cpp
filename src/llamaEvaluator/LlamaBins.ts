import {loadBin, type AddonModel, type AddonContext, type AddonGrammar, type AddonGrammarEvaluationState} from "../utils/getBin.js";

export const addonBinding = await loadBin();
const {AddonModel, AddonContext, AddonGrammar, AddonGrammarEvaluationState} = addonBinding;

export {AddonModel, AddonContext, AddonGrammar, AddonGrammarEvaluationState};

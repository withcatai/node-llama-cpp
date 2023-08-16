import {loadBin, type LLAMAModel, type LLAMAContext} from "../utils/getBin.js";

export const llamaCppNode = await loadBin();
const {LLAMAModel, LLAMAContext} = llamaCppNode;

export {LLAMAModel, LLAMAContext};

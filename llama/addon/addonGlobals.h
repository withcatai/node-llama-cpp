#pragma once
#include "napi.h"

class AddonModel;
class AddonModelLora;
class AddonModelData;
class AddonContext;
class AddonGrammar;
class AddonGrammarEvaluationState;

void adjustNapiExternalMemoryAdd(Napi::Env env, uint64_t size);
void adjustNapiExternalMemorySubtract(Napi::Env env, uint64_t size);

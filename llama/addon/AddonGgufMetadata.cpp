#include <cstddef>
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <vector>

#include "AddonGgufMetadata.h"
#include "gguf.h"
#include "llama.h"


static constexpr const char* kGgufSplitNoKey = "split.no";
static constexpr const char* kGgufSplitCountKey = "split.count";
static constexpr const char* kGgufSplitTensorsCountKey = "split.tensors.count";

static std::optional<uint16_t> getOptionalGgufU16(const gguf_context* metadata, const char* key) {
    const int64_t keyId = gguf_find_key(metadata, key);
    if (keyId < 0) {
        return std::nullopt;
    }

    return gguf_get_val_u16(metadata, keyId);
}

static std::string getSplitPrefixFromPath(const std::string& path, const uint16_t splitNo, const uint16_t splitCount) {
    std::vector<char> splitPrefix(path.size() + 1, '\0');
    if (llama_split_prefix(splitPrefix.data(), splitPrefix.size(), path.c_str(), splitNo, splitCount) <= 0) {
        throw std::runtime_error("Invalid split GGUF path: " + path);
    }

    return std::string(splitPrefix.data());
}

static std::string getSplitPath(const std::string& splitPrefix, const uint16_t splitNo, const uint16_t splitCount) {
    std::vector<char> splitPath(splitPrefix.size() + 32, '\0');
    if (llama_split_path(splitPath.data(), splitPath.size(), splitPrefix.c_str(), splitNo, splitCount) <= 0) {
        throw std::runtime_error("Failed to construct GGUF split path for split " + std::to_string(splitNo));
    }

    return std::string(splitPath.data());
}


AddonGgufMetadata::AddonGgufMetadata(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<AddonGgufMetadata>(info),
      ggufMetadata(gguf_init_empty()) {
    if (ggufMetadata.get() == nullptr) {
        throw std::runtime_error("Failed to create an empty GGUF context");
    }
}
AddonGgufMetadata::~AddonGgufMetadata() {
    dispose();
}

void AddonGgufMetadata::dispose() {
    if (disposed) {
        return;
    }

    disposed = true;
    ggufMetadata.reset();
}

Napi::Value AddonGgufMetadata::Dispose(const Napi::CallbackInfo& info) {
    dispose();
    return info.Env().Undefined();
}

class AddonGgufMetadataInitWorker : public Napi::AsyncWorker {
    public:
        AddonGgufMetadata* addonGgufMetadata;
        std::vector<AddonGgufMetadataSource> sources;
        std::vector<Napi::Reference<Napi::Buffer<uint8_t>>> bufferRefs;

        AddonGgufMetadataInitWorker(const Napi::Env& env, AddonGgufMetadata* addonGgufMetadata)
            : Napi::AsyncWorker(env, "AddonGgufMetadataInitWorker"),
              addonGgufMetadata(addonGgufMetadata),
              deferred(Napi::Promise::Deferred::New(env)) {
            addonGgufMetadata->Ref();
        }
        ~AddonGgufMetadataInitWorker() {
            addonGgufMetadata->Unref();
        }

        Napi::Promise GetPromise() {
            return deferred.Promise();
        }

    protected:
        Napi::Promise::Deferred deferred;

        void Execute() {
            try {
                gguf_context_ptr& ggufMetadata = addonGgufMetadata->ggufMetadata;

                auto loadMetadataSource = [](const AddonGgufMetadataSource& itemSource, ggml_context_ptr& tensorContextGuard) {
                    struct ggml_context* tensorContext = nullptr;
                    struct gguf_init_params ggufParams = {
                        /* .no_alloc = */ true,
                        /* .ctx = */ &tensorContext,
                    };
                    gguf_context_ptr metadata;
                    if (itemSource.type == AddonGgufMetadataSourceType::buffer) {
                        FILE* tmp = tmpfile();
                        if (tmp) {
                            fwrite(itemSource.buffer.data, 1, itemSource.buffer.length, tmp);
                            rewind(tmp);
                            metadata.reset(gguf_init_from_file_ptr(tmp, ggufParams));
                            fclose(tmp);
                        }
                    } else {
                        metadata.reset(gguf_init_from_file(itemSource.path.c_str(), ggufParams));
                    }
                    tensorContextGuard.reset(tensorContext);

                    if (metadata.get() == nullptr || tensorContext == nullptr) {
                        throw std::runtime_error("Failed to parse GGUF metadata buffer");
                    }

                    return metadata;
                };

                std::vector<AddonGgufMetadataSource> resolvedSources = sources;
                if (!sources.empty()) {
                    ggml_context_ptr initialTensorContextGuard;
                    gguf_context_ptr initialMetadata = loadMetadataSource(sources.front(), initialTensorContextGuard);
                    const std::optional<uint16_t> splitCount = getOptionalGgufU16(initialMetadata.get(), kGgufSplitCountKey);

                    if (splitCount.has_value() && splitCount.value() > 1) {
                        if (sources.size() == 1) {
                            if (sources.front().type != AddonGgufMetadataSourceType::path) {
                                throw std::runtime_error(
                                    "Loading split GGUF metadata from source buffers requires all split parts to be provided"
                                );
                            }

                            const std::optional<uint16_t> splitNo = getOptionalGgufU16(initialMetadata.get(), kGgufSplitNoKey);
                            if (!splitNo.has_value()) {
                                throw std::runtime_error("Missing split.no metadata in split GGUF source");
                            }

                            const std::string splitPrefix = getSplitPrefixFromPath(
                                sources.front().path,
                                splitNo.value(),
                                splitCount.value()
                            );

                            resolvedSources.clear();
                            resolvedSources.reserve(splitCount.value());

                            for (uint16_t splitIndex = 0; splitIndex < splitCount.value(); ++splitIndex) {
                                resolvedSources.emplace_back(AddonGgufMetadataSource(
                                    getSplitPath(splitPrefix, splitIndex, splitCount.value())
                                ));
                            }
                        } else if (sources.size() != splitCount.value()) {
                            throw std::runtime_error(
                                "Expected " + std::to_string(splitCount.value()) +
                                " split GGUF sources, but got " + std::to_string(sources.size())
                            );
                        }
                    }
                }

                bool hasCopiedMetadata = false;
                int32_t mergedTensorCount = 0;
                std::optional<uint16_t> mergedSplitCount;
                for (size_t sourceIndex = 0; sourceIndex < resolvedSources.size(); sourceIndex++) {
                    const auto& itemSource = resolvedSources[sourceIndex];
                    ggml_context_ptr tensorContextGuard;
                    gguf_context_ptr metadata = loadMetadataSource(itemSource, tensorContextGuard);

                    if (!hasCopiedMetadata) {
                        gguf_set_kv(ggufMetadata.get(), metadata.get());
                        hasCopiedMetadata = true;
                        mergedSplitCount = getOptionalGgufU16(metadata.get(), kGgufSplitCountKey);
                    }

                    if (mergedSplitCount.has_value() && mergedSplitCount.value() > 1) {
                        const std::optional<uint16_t> splitNo = getOptionalGgufU16(metadata.get(), kGgufSplitNoKey);
                        if (!splitNo.has_value()) {
                            throw std::runtime_error("Missing split.no metadata in split GGUF source");
                        } else if (splitNo.value() != sourceIndex) {
                            throw std::runtime_error(
                                "Invalid split GGUF source order: expected split index " + std::to_string(sourceIndex) +
                                ", but got " + std::to_string(splitNo.value())
                            );
                        }

                        const std::optional<uint16_t> splitCount = getOptionalGgufU16(metadata.get(), kGgufSplitCountKey);
                        if (!splitCount.has_value()) {
                            throw std::runtime_error("Missing split.count metadata in split GGUF source");
                        } else if (splitCount.value() != mergedSplitCount.value()) {
                            throw std::runtime_error(
                                "Inconsistent split.count metadata in split GGUF source: expected " +
                                std::to_string(mergedSplitCount.value()) + ", but got " + std::to_string(splitCount.value())
                            );
                        }
                    }

                    for (ggml_tensor* tensor = ggml_get_first_tensor(tensorContextGuard.get()); tensor != nullptr;
                        tensor = ggml_get_next_tensor(tensorContextGuard.get(), tensor)) {
                        gguf_add_tensor(ggufMetadata.get(), tensor);
                        mergedTensorCount++;
                    }
                }

                if (mergedSplitCount.has_value() && mergedSplitCount.value() > 1) {
                    // mirror `gguf_merge` in `llama.cpp/tools/gguf-split/gguf-split.cpp`:
                    // copy the KV metadata from the first split, append tensors from all splits,
                    // then normalize the split bookkeeping so the merged context behaves like
                    // a single spliced GGUF instead of shard 0 with extra tensors appended.
                    gguf_set_val_u16(ggufMetadata.get(), kGgufSplitNoKey, 0);
                    gguf_set_val_u16(ggufMetadata.get(), kGgufSplitCountKey, 0);
                    gguf_set_val_i32(ggufMetadata.get(), kGgufSplitTensorsCountKey, mergedTensorCount);
                }
            } catch (const std::exception& e) {
                SetError(e.what());
            } catch (...) {
                SetError("Unknown error when loading GGUF metadata from the given sources");
            }
        }
        void OnOK() {
            deferred.Resolve(Env().Undefined());
        }
        void OnError(const Napi::Error& err) {
            deferred.Reject(err.Value());
        }
};

Napi::Value AddonGgufMetadata::Init(const Napi::CallbackInfo& info) {
    if (disposed) {
        Napi::Error::New(info.Env(), "Metadata is disposed").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    std::vector<AddonGgufMetadataSource> metadataSources;
    std::vector<Napi::Reference<Napi::Buffer<uint8_t>>> bufferRefs;

    if (info.Length() == 0 || !info[0].IsArray()) {
        Napi::TypeError::New(info.Env(), "Expected an array of sources as the first argument").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    const auto sourceBufferValues = info[0].As<Napi::Array>();
    const uint32_t sourcesCount = sourceBufferValues.Length();

    if (sourcesCount == 0) {
        Napi::TypeError::New(info.Env(), "Expected source array to contain at least one item").ThrowAsJavaScriptException();
        return info.Env().Undefined();
    }

    metadataSources.reserve(sourcesCount);
    bufferRefs.reserve(sourcesCount);

    for (uint32_t i = 0; i < sourcesCount; i++) {
        const auto sourceBufferValue = sourceBufferValues.Get(i);
        if (sourceBufferValue.IsBuffer()) {
            const auto sourceBuffer = sourceBufferValue.As<Napi::Buffer<uint8_t>>();
            metadataSources.emplace_back(AddonGgufMetadataSource(AddonGgufMetadataSourceBuffer(sourceBuffer.Data(), sourceBuffer.Length())));
            bufferRefs.emplace_back(Napi::Persistent(sourceBuffer));
        } else if (sourceBufferValue.IsString()) {
            const auto sourcePath = sourceBufferValue.As<Napi::String>().Utf8Value();
            metadataSources.emplace_back(AddonGgufMetadataSource(sourcePath));
        } else {
            Napi::TypeError::New(info.Env(), "Expected every source array item to be a Buffer or a string").ThrowAsJavaScriptException();
            return info.Env().Undefined();
        }
    }


    AddonGgufMetadataInitWorker* worker = new AddonGgufMetadataInitWorker(info.Env(), this);
    worker->sources.swap(metadataSources);
    worker->bufferRefs.swap(bufferRefs);

    worker->Queue();
    return worker->GetPromise();
}

void AddonGgufMetadata::init(Napi::Object exports) {
    exports.Set(
        "AddonGgufMetadata",
        DefineClass(
            exports.Env(),
            "AddonGgufMetadata",
            {
                InstanceMethod("init", &AddonGgufMetadata::Init),
                InstanceMethod("dispose", &AddonGgufMetadata::Dispose),
            }
        )
    );
}

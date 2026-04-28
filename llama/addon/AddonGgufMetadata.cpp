#include <cstddef>

#include "AddonGgufMetadata.h"
#include "gguf.h"


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

                bool hasCopiedMetadata = false;
                for (const auto& itemSource : sources) {
                    struct ggml_context* tensorContext = nullptr;
                    struct gguf_init_params ggufParams = {
                        /* .no_alloc = */ true,
                        /* .ctx = */ &tensorContext,
                    };
                    gguf_context_ptr metadata(
                        itemSource.type == AddonGgufMetadataSourceType::buffer
                            ? gguf_init_from_buffer(itemSource.buffer.data, itemSource.buffer.length, ggufParams)
                            : gguf_init_from_file(itemSource.path.c_str(), ggufParams)
                    );
                    ggml_context_ptr tensorContextGuard(tensorContext);

                    if (metadata.get() == nullptr || tensorContext == nullptr) {
                        throw std::runtime_error("Failed to parse GGUF metadata buffer");
                    }

                    if (!hasCopiedMetadata) {
                        gguf_set_kv(ggufMetadata.get(), metadata.get());
                        hasCopiedMetadata = true;
                    }

                    for (ggml_tensor* tensor = ggml_get_first_tensor(tensorContext); tensor != nullptr;
                        tensor = ggml_get_next_tensor(tensorContext, tensor)) {
                        gguf_add_tensor(ggufMetadata.get(), tensor);
                    }
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
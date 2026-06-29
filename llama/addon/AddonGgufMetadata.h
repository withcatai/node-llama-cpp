#pragma once

#include <cstddef>

#include "ggml-cpp.h"
#include "napi.h"


enum class AddonGgufMetadataSourceType {
        path = 0,
        buffer = 1
};

struct AddonGgufMetadataSourceBuffer {
        const uint8_t* data = nullptr;
        std::size_t length = 0;

        AddonGgufMetadataSourceBuffer() = default;
        AddonGgufMetadataSourceBuffer(const uint8_t* data, std::size_t length) : data(data), length(length) {
        }
};

struct AddonGgufMetadataSource {
        AddonGgufMetadataSourceType type = AddonGgufMetadataSourceType::path;
        std::string path;
        AddonGgufMetadataSourceBuffer buffer;

        AddonGgufMetadataSource() = default;
        explicit AddonGgufMetadataSource(std::string path) : type(AddonGgufMetadataSourceType::path), path(std::move(path)) {
        }
        explicit AddonGgufMetadataSource(AddonGgufMetadataSourceBuffer buffer) : type(AddonGgufMetadataSourceType::buffer), buffer(buffer) {
        }
};

class AddonGgufMetadata : public Napi::ObjectWrap<AddonGgufMetadata> {
    public:
        gguf_context_ptr ggufMetadata;
        bool disposed = false;

        AddonGgufMetadata(const Napi::CallbackInfo& info);
        ~AddonGgufMetadata();
        void dispose();

        Napi::Value Init(const Napi::CallbackInfo& info);
        Napi::Value Dispose(const Napi::CallbackInfo& info);

        static void init(Napi::Object exports);
};

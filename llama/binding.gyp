{
  "targets": [
    {
      "target_name": "llama",
      "sources": [
        "addon.cpp",
        "llama.cpp/ggml.c",
        "llama.cpp/ggml-alloc.c",
        "llama.cpp/k_quants.c",
        "llama.cpp/llama.cpp",
        "llama.cpp/common/common.cpp",
        "llama.cpp/common/grammar-parser.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "llama.cpp",
        "llama.cpp/common"
      ],
      "cflags": ["-fexceptions"],
      "cflags_cc": ["-fexceptions"],
      "defines": [ "GGML_USE_K_QUANTS", "NAPI_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCCLCompilerTool": { "AdditionalOptions": [ '/arch:AVX2', '/EHsc' ] }
      }
    }
  ]
}

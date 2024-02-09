cmake_minimum_required(VERSION 3.13)

project("llama-addon" C CXX)

if (MSVC)
  # add_compile_options(/EHsc)
else()
  add_compile_options(-fexceptions)
endif()

add_definitions(-DNAPI_VERSION=7)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

execute_process(COMMAND node -p "require('node-addon-api').include.slice(1,-1)"
                WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
                OUTPUT_VARIABLE NODE_ADDON_API_DIR
                OUTPUT_STRIP_TRAILING_WHITESPACE)

include_directories(${NODE_ADDON_API_DIR} ${CMAKE_JS_INC})

add_subdirectory("llama.cpp")
include_directories("gpuInfo")
include_directories("./llama.cpp/common")

if (LLAMA_CUBLAS)
    cmake_minimum_required(VERSION 3.17)

    find_package(CUDAToolkit)
    if (CUDAToolkit_FOUND)
        message(STATUS "Using cuBLAS for GPU info")

        enable_language(CUDA)

        set(GPU_INFO_HEADERS ${GPU_INFO_HEADERS} gpuInfo/cuda-gpu-info.h)
        set(GPU_INFO_SOURCES ${GPU_INFO_SOURCES} gpuInfo/cuda-gpu-info.cu)

        add_compile_definitions(GPU_INFO_USE_CUBLAS)

        set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS} CUDA::cuda_driver)

        if (NOT DEFINED CMAKE_CUDA_ARCHITECTURES)
            set(CMAKE_CUDA_ARCHITECTURES "")
        endif()
    else()
        message(WARNING "cuBLAS not found. Not using it for GPU info")
    endif()
endif()

include_directories("llama.cpp")

if (LLAMA_HIPBLAS)
    list(APPEND CMAKE_PREFIX_PATH /opt/rocm)

    if (NOT ${CMAKE_C_COMPILER_ID} MATCHES "Clang")
        message(WARNING "Only LLVM is supported for HIP, hint: CC=/opt/rocm/llvm/bin/clang")
    endif()
    if (NOT ${CMAKE_CXX_COMPILER_ID} MATCHES "Clang")
        message(WARNING "Only LLVM is supported for HIP, hint: CXX=/opt/rocm/llvm/bin/clang++")
    endif()

    find_package(hip)
    find_package(hipblas)
    find_package(rocblas)

    if (${hipblas_FOUND} AND ${hip_FOUND})
        message(STATUS "Using HIP and hipBLAS for GPU info")
        add_compile_definitions(GPU_INFO_USE_HIPBLAS GPU_INFO_USE_CUBLAS)
        add_library(gpu-info-rocm OBJECT gpuInfo/cuda-gpu-info.cu gpuInfo/cuda-gpu-info.h)
        set_source_files_properties(gpuInfo/cuda-gpu-info.cu PROPERTIES LANGUAGE CXX)
        target_link_libraries(gpu-info-rocm PRIVATE hip::device PUBLIC hip::host roc::rocblas roc::hipblas)

        set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS} gpu-info-rocm)
    else()
        message(WARNING "hipBLAS or HIP not found. Try setting CMAKE_PREFIX_PATH=/opt/rocm")
    endif()
endif()

if (LLAMA_METAL)
    find_library(FOUNDATION_LIBRARY Foundation REQUIRED)
    find_library(METAL_FRAMEWORK    Metal      REQUIRED)
    find_library(METALKIT_FRAMEWORK MetalKit   REQUIRED)

    message(STATUS "Using Metal for GPU info")
    set(GPU_INFO_HEADERS ${GPU_INFO_HEADERS}  gpuInfo/metal-gpu-info.h)
    set(GPU_INFO_SOURCES ${GPU_INFO_SOURCES} gpuInfo/metal-gpu-info.mm)

    add_compile_definitions(GPU_INFO_USE_METAL)

    set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS}
        ${FOUNDATION_LIBRARY}
        ${METAL_FRAMEWORK}
        ${METALKIT_FRAMEWORK}
        )
endif()

file(GLOB SOURCE_FILES "addon.cpp" ${GPU_INFO_SOURCES})

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC} ${GPU_INFO_HEADERS})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})
target_link_libraries(${PROJECT_NAME} "llama")
target_link_libraries(${PROJECT_NAME} "common")
target_link_libraries(${PROJECT_NAME} ${GPU_INFO_EXTRA_LIBS})

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()

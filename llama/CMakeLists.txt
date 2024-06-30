cmake_minimum_required(VERSION 3.14)

project("llama-addon" C CXX)

if (MSVC)
    if (GGML_STATIC)
        add_link_options(-static)
        if (MINGW)
            add_link_options(-static-libgcc -static-libstdc++)
        endif()
    endif()
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
include_directories("llama.cpp")
include_directories("./llama.cpp/common")

if (GGML_CUDA)
    cmake_minimum_required(VERSION 3.17)

    find_package(CUDAToolkit)
    if (CUDAToolkit_FOUND)
        message(STATUS "Using CUDA for GPU info")

        enable_language(CUDA)

        set(GPU_INFO_HEADERS ${GPU_INFO_HEADERS} gpuInfo/cuda-gpu-info.h)
        set(GPU_INFO_SOURCES ${GPU_INFO_SOURCES} gpuInfo/cuda-gpu-info.cu)

        add_compile_definitions(GPU_INFO_USE_CUDA)

        if (GGML_STATIC)
            set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS} CUDA::cudart_static)
        else()
            set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS} CUDA::cudart)
        endif()

        set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS} CUDA::cuda_driver)

        if (NOT DEFINED CMAKE_CUDA_ARCHITECTURES)
            # copied from llama.cpp/CMakLists.txt under "if (NOT DEFINED CMAKE_CUDA_ARCHITECTURES)"
            if (GGML_CUDA_F16 OR GGML_CUDA_DMMV_F16)
                set(CMAKE_CUDA_ARCHITECTURES "60;61;70;75")
            else()
                set(CMAKE_CUDA_ARCHITECTURES "52;61;70;75")
            endif()
        endif()
    else()
        message(FATAL_ERROR "CUDA was not found")
    endif()
endif()

if (GGML_VULKAN OR GGML_KOMPUTE)
    find_package(Vulkan)
    if (Vulkan_FOUND)
        if (GGML_VULKAN)
            message(STATUS "Using Vulkan for GPU info")
        elseif (GGML_KOMPUTE)
            message(STATUS "Using Vulkan for GPU info because Kompute is enabled")
        endif()

        set(GPU_INFO_HEADERS ${GPU_INFO_HEADERS} gpuInfo/vulkan-gpu-info.h)
        set(GPU_INFO_SOURCES ${GPU_INFO_SOURCES} gpuInfo/vulkan-gpu-info.cpp)

        add_compile_definitions(GPU_INFO_USE_VULKAN)

        set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS} Vulkan::Vulkan)
    else()
        message(FATAL_ERROR "Vulkan was not found")
    endif()
endif()

if (GGML_HIPBLAS)
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
        add_compile_definitions(GPU_INFO_USE_HIPBLAS GPU_INFO_USE_CUDA)
        add_library(gpu-info-rocm OBJECT gpuInfo/cuda-gpu-info.cu gpuInfo/cuda-gpu-info.h)
        set_source_files_properties(gpuInfo/cuda-gpu-info.cu PROPERTIES LANGUAGE CXX)
        target_link_libraries(gpu-info-rocm PRIVATE hip::device PUBLIC hip::host roc::rocblas roc::hipblas)

        set(GPU_INFO_EXTRA_LIBS ${GPU_INFO_EXTRA_LIBS} gpu-info-rocm)
    else()
        message(FATAL_ERROR "hipBLAS or HIP was not found. Try setting CMAKE_PREFIX_PATH=/opt/rocm")
    endif()
endif()

if (GGML_METAL)
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

if(APPLE)
    set(CMAKE_SKIP_BUILD_RPATH  FALSE)
    set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)
    set(CMAKE_BUILD_RPATH "@loader_path")
    set(CMAKE_INSTALL_RPATH "@loader_path")
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
else()
    set(CMAKE_BUILD_RPATH_USE_ORIGIN ON)
endif()

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC} ${GPU_INFO_HEADERS})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})
target_link_libraries(${PROJECT_NAME} "llama")
target_link_libraries(${PROJECT_NAME} "common")

if (DEFINED GPU_INFO_EXTRA_LIBS)
    target_link_libraries(${PROJECT_NAME} ${GPU_INFO_EXTRA_LIBS})
endif()

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()

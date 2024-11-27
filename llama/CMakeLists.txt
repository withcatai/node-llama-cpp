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

set(LLAMA_BUILD_COMMON ON)

if (CMAKE_CXX_COMPILER_ID STREQUAL "Clang" OR CMAKE_CXX_COMPILER_ID STREQUAL "AppleClang")
    add_compile_options(-Wno-c++17-extensions)
endif()

if(APPLE)
    set(CMAKE_SKIP_BUILD_RPATH  FALSE)
    set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)
    set(CMAKE_BUILD_RPATH "@loader_path")
    set(CMAKE_INSTALL_RPATH "@loader_path")
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
else()
    set(CMAKE_BUILD_RPATH_USE_ORIGIN ON)
endif()

include_directories(${NODE_ADDON_API_DIR} ${CMAKE_JS_INC})

add_subdirectory("llama.cpp")
include_directories("gpuInfo")
include_directories("llama.cpp")
include_directories("./llama.cpp/common")

unset(GPU_INFO_HEADERS)
unset(GPU_INFO_SOURCES)
unset(GPU_INFO_EXTRA_LIBS)

if (GGML_VULKAN OR GGML_KOMPUTE)
    find_package(Vulkan)
    if (Vulkan_FOUND)
        if (GGML_VULKAN)
            message(STATUS "Using Vulkan for GPU info")
        elseif (GGML_KOMPUTE)
            message(STATUS "Using Vulkan for GPU info because Kompute is enabled")
        endif()

        list(APPEND GPU_INFO_HEADERS gpuInfo/vulkan-gpu-info.h)
        list(APPEND GPU_INFO_SOURCES gpuInfo/vulkan-gpu-info.cpp)

        add_compile_definitions(GPU_INFO_USE_VULKAN)

        list(APPEND GPU_INFO_EXTRA_LIBS Vulkan::Vulkan)
    else()
        message(FATAL_ERROR "Vulkan was not found")
    endif()
endif()

list(REMOVE_DUPLICATES GPU_INFO_HEADERS)
list(REMOVE_DUPLICATES GPU_INFO_SOURCES)
list(REMOVE_DUPLICATES GPU_INFO_EXTRA_LIBS)

file(GLOB SOURCE_FILES "addon/*.cpp" "addon/**/*.cpp" ${GPU_INFO_SOURCES})

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

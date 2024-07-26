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
include_directories("llama.cpp")
include_directories("./llama.cpp/common")

file(GLOB SOURCE_FILES "addon.cpp")

if(APPLE)
    set(CMAKE_SKIP_BUILD_RPATH  FALSE)
    set(CMAKE_INSTALL_RPATH_USE_LINK_PATH FALSE)
    set(CMAKE_BUILD_RPATH "@loader_path")
    set(CMAKE_INSTALL_RPATH "@loader_path")
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)
else()
    set(CMAKE_BUILD_RPATH_USE_ORIGIN ON)
endif()

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})
target_link_libraries(${PROJECT_NAME} "llama")
target_link_libraries(${PROJECT_NAME} "common")

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()

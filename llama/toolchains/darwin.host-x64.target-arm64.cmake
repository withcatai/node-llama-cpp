set(CMAKE_SYSTEM_NAME Darwin) # macOS
set(CMAKE_SYSTEM_PROCESSOR arm64)

set(CMAKE_C_COMPILER /usr/bin/clang)
set(CMAKE_CXX_COMPILER /usr/bin/clang++)

set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -arch arm64")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -arch arm64")

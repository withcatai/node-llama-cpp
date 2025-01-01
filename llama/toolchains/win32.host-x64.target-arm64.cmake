set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR arm64)

set(target arm64-pc-windows-msvc)
set(CMAKE_C_COMPILER_TARGET ${target})
set(CMAKE_CXX_COMPILER_TARGET ${target})

include(../cmake/win32.programFilesPaths.cmake)
setProgramFilesPaths("x64" PROGRAMFILES_PATHS)

include(../cmake/win32.llvmUseGnuModeCompilers.cmake)
llvmUseGnuModeCompilers("x64" PROGRAMFILES_PATHS)

include(../cmake/win32.ensureNinjaPath.cmake)
ensureNinjaPath(PROGRAMFILES_PATHS)

set(arch_c_flags "-march=armv8.7-a -fvectorize -ffp-model=fast -fno-finite-math-only")
set(warn_c_flags "-Wno-format -Wno-unused-variable -Wno-unused-function -Wno-gnu-zero-variadic-macro-arguments")

set(CMAKE_C_FLAGS_INIT "${arch_c_flags} ${warn_c_flags}")
set(CMAKE_CXX_FLAGS_INIT "${arch_c_flags} ${warn_c_flags}")

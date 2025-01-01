set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR arm64)

set(target arm64-pc-windows-msvc)
set(CMAKE_C_COMPILER_TARGET ${target})
set(CMAKE_CXX_COMPILER_TARGET ${target})

set(CMAKE_C_COMPILER clang)
set(CMAKE_CXX_COMPILER clang++)
set(CMAKE_RC_COMPILER llvm-rc)

set(LLVM_INSTALLATION_URL "https://github.com/llvm/llvm-project/releases/tag/llvmorg-19.1.5")

set(PROGRAMFILES "$ENV{ProgramFiles}")
set(PROGRAMFILES_X86 "$ENV{ProgramFiles\(x86\)}")
file(TO_CMAKE_PATH "${PROGRAMFILES}" PROGRAMFILES)
file(TO_CMAKE_PATH "${PROGRAMFILES_X86}" PROGRAMFILES_X86)
set(PROGRAMFILES_PATHS
    "${PROGRAMFILES}"
    "${PROGRAMFILES_X86}"
    "C:/Program Files"
    "C:/Program Files (x86)"
)

set(LLVM_INSTALL_PATHS "")
foreach(PATH IN LISTS PROGRAMFILES_PATHS)
    list(APPEND LLVM_INSTALL_PATHS "${PATH}/LLVM")

    file(GLOB_RECURSE FOUND_LLVM_ROOT
        "${PATH}/Microsoft Visual Studio/*/VC/Tools/Llvm/x64"
        "${PATH}/Microsoft Visual Studio/**/*/VC/Tools/Llvm/x64")

    if(FOUND_LLVM_ROOT)
        list(APPEND LLVM_INSTALL_PATHS ${FOUND_LLVM_ROOT})
    endif()
endforeach()

if(DEFINED LLVM_ROOT AND EXISTS "${LLVM_ROOT}")
    list(INSERT LLVM_INSTALL_PATHS 0 "${LLVM_ROOT}")
endif()

set(LLVM_ROOT "")
foreach(PATH IN LISTS LLVM_INSTALL_PATHS)
    if(EXISTS "${PATH}/bin/clang.exe" AND EXISTS "${PATH}/bin/clang++.exe" AND EXISTS "${PATH}/bin/llvm-rc.exe")
        set(LLVM_ROOT "${PATH}")
        break()
    endif()
endforeach()

if(LLVM_ROOT STREQUAL "")
    message(FATAL_ERROR "LLVM installation was not found. Please install LLVM: ${LLVM_INSTALLATION_URL}")
endif()

if (NOT EXISTS "${CMAKE_C_COMPILER}" OR NOT EXISTS "${CMAKE_CXX_COMPILER}" OR NOT EXISTS "${CMAKE_RC_COMPILER}")
    set(CMAKE_C_COMPILER "${LLVM_ROOT}/bin/clang.exe")
    set(CMAKE_CXX_COMPILER "${LLVM_ROOT}/bin/clang++.exe")
    set(CMAKE_RC_COMPILER "${LLVM_ROOT}/bin/llvm-rc.exe")
endif()

if (NOT EXISTS "${CMAKE_C_COMPILER}")
    message(FATAL_ERROR "Clang compiler not found at ${CMAKE_C_COMPILER}. Please reinstall LLVM: ${LLVM_INSTALLATION_URL}")
endif()
if (NOT EXISTS "${CMAKE_CXX_COMPILER}")
    message(FATAL_ERROR "Clang++ compiler not found at ${CMAKE_CXX_COMPILER}. Please reinstall LLVM: ${LLVM_INSTALLATION_URL}")
endif()
if (NOT EXISTS "${CMAKE_RC_COMPILER}")
    message(FATAL_ERROR "LLVM Resource Compiler not found at ${CMAKE_RC_COMPILER}. Please reinstall LLVM: ${LLVM_INSTALLATION_URL}")
endif()

set(arch_c_flags "-march=armv8.7-a -fvectorize -ffp-model=fast -fno-finite-math-only")
set(warn_c_flags "-Wno-format -Wno-unused-variable -Wno-unused-function -Wno-gnu-zero-variadic-macro-arguments")

set(CMAKE_C_FLAGS_INIT "${arch_c_flags} ${warn_c_flags}")
set(CMAKE_CXX_FLAGS_INIT "${arch_c_flags} ${warn_c_flags}")

if ((NOT DEFINED CMAKE_MAKE_PROGRAM OR NOT EXISTS CMAKE_MAKE_PROGRAM) AND (CMAKE_GENERATOR STREQUAL "Ninja" OR CMAKE_GENERATOR STREQUAL "Ninja Multi-Config"))
    find_program(NINJA_EXECUTABLE ninja)

    if(NINJA_EXECUTABLE AND EXISTS "${NINJA_EXECUTABLE}")
        set(CMAKE_MAKE_PROGRAM "${NINJA_EXECUTABLE}")
    else()
        foreach(PATH IN LISTS PROGRAMFILES_PATHS)
            file(GLOB_RECURSE FOUND_NINJA_EXE
                "${PATH}/Microsoft Visual Studio/*/CMake/Ninja/ninja.exe"
                "${PATH}/Microsoft Visual Studio/**/*/CMake/Ninja/ninja.exe")

            if(FOUND_NINJA_EXE)
                list(GET FOUND_NINJA_EXE 0 CMAKE_MAKE_PROGRAM)
                break()
            endif()
        endforeach()
    endif()

    if (NOT CMAKE_MAKE_PROGRAM OR NOT EXISTS "${CMAKE_MAKE_PROGRAM}")
        message(FATAL_ERROR "Ninja build system not found. Please install Ninja or Visual Studio Build Tools.")
    endif()
endif()

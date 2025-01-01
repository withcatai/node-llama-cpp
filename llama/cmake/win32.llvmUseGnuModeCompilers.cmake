function(llvmUseGnuModeCompilers CURRENT_ARCH PROGRAMFILES_PATHS)
    set(LLVM_INSTALLATION_URL "https://github.com/llvm/llvm-project/releases/tag/llvmorg-19.1.5")

    set(CMAKE_C_COMPILER clang)
    set(CMAKE_CXX_COMPILER clang++)
    set(CMAKE_RC_COMPILER llvm-rc)


    set (LLVM_DIR_ARCH_NAME "")
    if (CURRENT_ARCH STREQUAL "x64")
        set (LLVM_DIR_ARCH_NAME "x64")
    elseif (CURRENT_ARCH STREQUAL "arm64")
        set (LLVM_DIR_ARCH_NAME "ARM64")
    endif()

    set(LLVM_INSTALL_PATHS "")
    foreach(PATH IN LISTS PROGRAMFILES_PATHS)
        list(APPEND LLVM_INSTALL_PATHS "${PATH}/LLVM")

        file(GLOB_RECURSE FOUND_LLVM_ROOT
            "${PATH}/Microsoft Visual Studio/*/VC/Tools/Llvm/${LLVM_DIR_ARCH_NAME}"
            "${PATH}/Microsoft Visual Studio/**/*/VC/Tools/Llvm/${LLVM_DIR_ARCH_NAME}")

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
        if (CURRENT_ARCH STREQUAL "arm64")
            message(FATAL_ERROR "LLVM installation was not found. Please install LLVM for WoA (Windows on Arm): ${LLVM_INSTALLATION_URL}")
        else()
            message(FATAL_ERROR "LLVM installation was not found. Please install LLVM: ${LLVM_INSTALLATION_URL}")
        endif()
    endif()

    if (NOT EXISTS "${CMAKE_C_COMPILER}" OR NOT EXISTS "${CMAKE_CXX_COMPILER}" OR NOT EXISTS "${CMAKE_RC_COMPILER}")
        set(CMAKE_C_COMPILER "${LLVM_ROOT}/bin/clang.exe")
        set(CMAKE_CXX_COMPILER "${LLVM_ROOT}/bin/clang++.exe")
        set(CMAKE_RC_COMPILER "${LLVM_ROOT}/bin/llvm-rc.exe")
    endif()

    if (NOT EXISTS "${CMAKE_C_COMPILER}")
        if (CURRENT_ARCH STREQUAL "arm64")
            message(FATAL_ERROR "Clang compiler not found at ${CMAKE_C_COMPILER}. Please reinstall LLVM for WoA (Windows on Arm): ${LLVM_INSTALLATION_URL}")
        else()
            message(FATAL_ERROR "Clang compiler not found at ${CMAKE_C_COMPILER}. Please reinstall LLVM: ${LLVM_INSTALLATION_URL}")
        endif()
    endif()
    if (NOT EXISTS "${CMAKE_CXX_COMPILER}")
        if (CURRENT_ARCH STREQUAL "arm64")
            message(FATAL_ERROR "Clang++ compiler not found at ${CMAKE_CXX_COMPILER}. Please reinstall LLVM for WoA (Windows on Arm): ${LLVM_INSTALLATION_URL}")
        else()
            message(FATAL_ERROR "Clang++ compiler not found at ${CMAKE_CXX_COMPILER}. Please reinstall LLVM: ${LLVM_INSTALLATION_URL}")
        endif()
    endif()
    if (NOT EXISTS "${CMAKE_RC_COMPILER}")
        if (CURRENT_ARCH STREQUAL "arm64")
            message(FATAL_ERROR "LLVM Resource Compiler not found at ${CMAKE_RC_COMPILER}. Please reinstall LLVM for WoA (Windows on Arm): ${LLVM_INSTALLATION_URL}")
        else()
            message(FATAL_ERROR "LLVM Resource Compiler not found at ${CMAKE_RC_COMPILER}. Please reinstall LLVM: ${LLVM_INSTALLATION_URL}")
        endif()
    endif()
endfunction()

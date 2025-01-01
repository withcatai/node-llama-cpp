function(llvmEnsureCmakeAr PROGRAMFILES_PATHS CURRENT_ARCH)
    set (LLVM_DIR_ARCH_NAME "")
    if (CURRENT_ARCH STREQUAL "x64")
        set (LLVM_DIR_ARCH_NAME "x64")
    elseif (CURRENT_ARCH STREQUAL "arm64")
        set (LLVM_DIR_ARCH_NAME "ARM64")
    endif()

    if (NOT DEFINED CMAKE_AR OR NOT EXISTS "${CMAKE_AR}")
        set(LLVM_INSTALL_PATHS "")
        foreach(PATH IN LISTS PROGRAMFILES_PATHS)
            list(APPEND LLVM_INSTALL_PATHS "${PATH}/LLVM")

            file(GLOB_RECURSE FOUND_LLVM_ROOT
                "${PATH}/Microsoft Visual Studio/*/VC/Tools/Llvm/${CURRENT_ARCH}"
                "${PATH}/Microsoft Visual Studio/**/*/VC/Tools/Llvm/${CURRENT_ARCH}")

            if(FOUND_LLVM_ROOT)
                list(APPEND LLVM_INSTALL_PATHS ${FOUND_LLVM_ROOT})
            endif()
        endforeach()

        if(DEFINED LLVM_ROOT AND EXISTS "${LLVM_ROOT}")
            list(INSERT LLVM_INSTALL_PATHS 0 "${LLVM_ROOT}")
        endif()

        foreach(PATH IN LISTS LLVM_INSTALL_PATHS)
            if(EXISTS "${PATH}/bin/llvm-ar.exe" AND EXISTS "${PATH}/bin/llvm-ar.exe")
                set(CMAKE_AR "${PATH}/bin/llvm-ar.exe")
                break()
            endif()
        endforeach()
    endif()
endfunction()

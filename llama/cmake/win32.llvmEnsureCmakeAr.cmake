function(llvmEnsureCmakeAr CURRENT_ARCH)
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

            file(GLOB_RECURSE FOUND_LLVM_ROOT LIST_DIRECTORIES true
                "${PATH}/Microsoft Visual Studio/*/VC/Tools/Llvm/${LLVM_DIR_ARCH_NAME}"
                "${PATH}/Microsoft Visual Studio/**/*/VC/Tools/Llvm/${LLVM_DIR_ARCH_NAME}")
            list(FILTER FOUND_LLVM_ROOT INCLUDE REGEX "VC/Tools/Llvm/${LLVM_DIR_ARCH_NAME}$")

            if(FOUND_LLVM_ROOT)
                list(APPEND LLVM_INSTALL_PATHS ${FOUND_LLVM_ROOT})
            endif()
        endforeach()

        if(DEFINED LLVM_ROOT AND EXISTS "${LLVM_ROOT}")
            list(INSERT LLVM_INSTALL_PATHS 0 "${LLVM_ROOT}")
        endif()

        list(REMOVE_DUPLICATES LLVM_INSTALL_PATHS)

        foreach(PATH IN LISTS LLVM_INSTALL_PATHS)
            if(EXISTS "${PATH}/bin/llvm-ar.exe" AND EXISTS "${PATH}/bin/llvm-ar.exe")
                set(CMAKE_AR "${PATH}/bin/llvm-ar.exe" PARENT_SCOPE)
                break()
            endif()
        endforeach()
    endif()
endfunction()

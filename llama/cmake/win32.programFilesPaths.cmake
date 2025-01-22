function(setProgramFilesPaths CURRENT_ARCH)
    set(PROGRAMFILES_X86_ENV_NAME "ProgramFiles(x86)")

    set(PROGRAMFILES "$ENV{ProgramFiles}")
    set(PROGRAMFILES_X86 "$ENV{${PROGRAMFILES_X86_ENV_NAME}}")
    file(TO_CMAKE_PATH "${PROGRAMFILES}" PROGRAMFILES)
    file(TO_CMAKE_PATH "${PROGRAMFILES_X86}" PROGRAMFILES_X86)

    if(CURRENT_ARCH STREQUAL "arm64")
        set(PROGRAMFILES_ARM64_ENV_NAME "ProgramFiles(Arm)")

        set(PROGRAMFILES_ARM64 "$ENV{${PROGRAMFILES_ARM64_ENV_NAME}}")
        file(TO_CMAKE_PATH "${PROGRAMFILES_ARM64}" PROGRAMFILES_ARM64)

        set(PROGRAMFILES_PATHS_LIST
            "${PROGRAMFILES_ARM64}"
            "${PROGRAMFILES}"
            "${PROGRAMFILES_X86}"
            "C:/Program Files (Arm)"
            "C:/Program Files"
            "C:/Program Files (x86)"
        )
        list(REMOVE_DUPLICATES PROGRAMFILES_PATHS_LIST)
        set(PROGRAMFILES_PATHS ${PROGRAMFILES_PATHS_LIST} PARENT_SCOPE)
    else()
        set(PROGRAMFILES_PATHS_LIST
            "${PROGRAMFILES}"
            "${PROGRAMFILES_X86}"
            "C:/Program Files"
            "C:/Program Files (x86)"
        )
        list(REMOVE_DUPLICATES PROGRAMFILES_PATHS_LIST)
        set(PROGRAMFILES_PATHS ${PROGRAMFILES_PATHS_LIST} PARENT_SCOPE)
    endif()
endfunction()

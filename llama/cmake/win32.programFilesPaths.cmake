function(setProgramFilesPaths CURRENT_ARCH)
    set(PROGRAMFILES "$ENV{ProgramFiles}")
    set(PROGRAMFILES_X86 "$ENV{ProgramFiles\(x86\)}")
    file(TO_CMAKE_PATH "${PROGRAMFILES}" PROGRAMFILES)
    file(TO_CMAKE_PATH "${PROGRAMFILES_X86}" PROGRAMFILES_X86)

    if(CURRENT_ARCH STREQUAL "arm64")
        set(PROGRAMFILES_ARM64 "$ENV{ProgramFiles\(Arm\)}")
        file(TO_CMAKE_PATH "${PROGRAMFILES_ARM64}" PROGRAMFILES_ARM64)

        set(PROGRAMFILES_PATHS
            "${PROGRAMFILES_ARM64}"
            "${PROGRAMFILES}"
            "${PROGRAMFILES_X86}"
            "C:/Program Files (Arm)"
            "C:/Program Files"
            "C:/Program Files (x86)"
            PARENT_SCOPE
        )
    else()
        set(PROGRAMFILES_PATHS
            "${PROGRAMFILES}"
            "${PROGRAMFILES_X86}"
            "C:/Program Files"
            "C:/Program Files (x86)"
            PARENT_SCOPE
        )
    endif()
endfunction()

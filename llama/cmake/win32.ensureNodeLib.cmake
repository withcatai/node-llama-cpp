function(ensureNodeLib HOST_ARCH TARGET_ARCH)
    if (CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
        if (NOT DEFINED NODE_LIB_CMAKE_AR)
            foreach(PATH IN LISTS PROGRAMFILES_PATHS)
                if(NODE_LIB_CMAKE_AR)
                    break()
                endif()

                file(GLOB_RECURSE FOUND_LIB_EXE
                    "${PATH}/Microsoft Visual Studio/*/VC/Tools/MSVC/*/bin/Host${HOST_ARCH}/${TARGET_ARCH}/lib.exe"
                    "${PATH}/Microsoft Visual Studio/**/*/VC/Tools/MSVC/*/bin/Host${HOST_ARCH}/${TARGET_ARCH}/lib.exe")

                if(FOUND_LIB_EXE)
                    list(GET FOUND_LIB_EXE 0 NODE_LIB_CMAKE_AR)
                    break()
                endif()
            endforeach()
        endif()

        set(NODE_LIB_CMAKE_AR_MACHINE_FLAG "")
        if (TARGET_ARCH STREQUAL "x64")
            set(NODE_LIB_CMAKE_AR_MACHINE_FLAG "/MACHINE:X64")
        elseif (TARGET_ARCH STREQUAL "arm64")
            set(NODE_LIB_CMAKE_AR_MACHINE_FLAG "/MACHINE:ARM64")
        endif()

        if (EXISTS "${NODE_LIB_CMAKE_AR}")
            # Generate node.lib
            execute_process(COMMAND ${NODE_LIB_CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS} ${NODE_LIB_CMAKE_AR_MACHINE_FLAG} /nologo)
        else()
            message(FATAL_ERROR "Windows Resource Compiler (lib.exe) not found. Please install Visual Studio Build Tools.")
        endif()
    endif()
endfunction()

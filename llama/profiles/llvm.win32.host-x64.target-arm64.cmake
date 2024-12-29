set(PROGRAMFILES "$ENV{ProgramFiles}")
set(PROGRAMFILES_X86 "$ENV{ProgramFiles\(x86\)}")
set(PROGRAMFILES_PATHS
    "${PROGRAMFILES}"
    "${PROGRAMFILES_X86}"
    "C:/Program Files"
    "C:/Program Files (x86)"
)

if (CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
    if (NOT DEFINED NODE_LIB_CMAKE_AR)
        foreach(PATH IN LISTS PROGRAMFILES_PATHS)
            if(NODE_LIB_CMAKE_AR)
                break()
            endif()

            file(GLOB_RECURSE FOUND_LIB_EXE
                "${PATH}/Microsoft Visual Studio/*/VC/Tools/MSVC/*/bin/Hostx64/arm64/lib.exe"
                "${PATH}/Microsoft Visual Studio/**/*/VC/Tools/MSVC/*/bin/Hostx64/arm64/lib.exe")

            if(FOUND_LIB_EXE)
                list(GET FOUND_LIB_EXE 0 NODE_LIB_CMAKE_AR)
                break()
            endif()
        endforeach()
    endif()

    if (EXISTS "${NODE_LIB_CMAKE_AR}")
        # Generate node.lib
        execute_process(COMMAND ${NODE_LIB_CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS} /MACHINE:ARM64 /nologo)
    else()
        message(FATAL_ERROR "Windows Resource Compiler (lib.exe) not found. Please install Visual Studio Build Tools.")
    endif()
endif()

# adapt cmake-js to work with llvm in GNU mode
if (NOT CMAKE_SHARED_LINKER_FLAGS MATCHES "-Xlinker /DELAYLOAD:NODE.EXE")
    string(REPLACE "/DELAYLOAD:NODE.EXE" "-Xlinker /DELAYLOAD:NODE.EXE -Xlinker /defaultlib:delayimp"
        CMAKE_SHARED_LINKER_FLAGS
        "${CMAKE_SHARED_LINKER_FLAGS}")
endif()

set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)
set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} -Xclang --dependent-lib=msvcrt")
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -Xclang --dependent-lib=msvcrt")

# ensure CMAKE_AR is configured
if (NOT DEFINED CMAKE_AR OR NOT EXISTS "${CMAKE_AR}")
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

    foreach(PATH IN LISTS LLVM_INSTALL_PATHS)
        if(EXISTS "${PATH}/bin/llvm-ar.exe" AND EXISTS "${PATH}/bin/llvm-ar.exe")
            set(CMAKE_AR "${PATH}/bin/llvm-ar.exe")
            break()
        endif()
    endforeach()
endif()
set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR ARM64)

# Look for cl.exe in the Visual Studio installation directories
set(PROGRAMFILES "$ENV{ProgramFiles}")
set(PROGRAMFILES_X86 "$ENV{ProgramFiles\(x86\)}")

set(VS_INSTALL_PATHS
    "${PROGRAMFILES_X86}/Microsoft Visual Studio"
    "${PROGRAMFILES}/Microsoft Visual Studio"
    "C:/Program Files (x86)/Microsoft Visual Studio"
    "C:/Program Files/Microsoft Visual Studio"
)
foreach(PATH IN LISTS VS_INSTALL_PATHS)
    if(CL_EXE_PATH)
        break()
    endif()

    file(GLOB_RECURSE FOUND_CL_EXE "${PATH}/*/VC/Tools/MSVC/*/bin/Hostx64/arm64/cl.exe")
    if(FOUND_CL_EXE)
        list(GET FOUND_CL_EXE 0 CL_EXE_PATH)
        break()
    endif()

    if(CL_EXE_PATH)
        break()
    endif()

    file(GLOB_RECURSE FOUND_CL_EXE "${PATH}/**/*/VC/Tools/MSVC/*/bin/Hostx64/arm64/cl.exe")
    if(FOUND_CL_EXE)
        list(GET FOUND_CL_EXE 0 CL_EXE_PATH)
        break()
    endif()
endforeach()

if(NOT CL_EXE_PATH)
    message(FATAL_ERROR "cl.exe not found for ARM architecture.")
else()
    set(CMAKE_C_COMPILER "${CL_EXE_PATH}")
    set(CMAKE_CXX_COMPILER "${CL_EXE_PATH}")
endif()

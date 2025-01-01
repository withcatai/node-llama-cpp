function(llvmApplyGnuModeAdaptations)
    # adapt cmake-js to work with llvm in GNU mode
    if (NOT CMAKE_SHARED_LINKER_FLAGS MATCHES "-Xlinker /DELAYLOAD:NODE.EXE")
    string(REPLACE "/DELAYLOAD:NODE.EXE" "-Xlinker /DELAYLOAD:NODE.EXE -Xlinker /defaultlib:delayimp"
        CMAKE_SHARED_LINKER_FLAGS
        "${CMAKE_SHARED_LINKER_FLAGS}")
    endif()

    set(CMAKE_WINDOWS_EXPORT_ALL_SYMBOLS ON)
    set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} -Xclang --dependent-lib=msvcrt")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -Xclang --dependent-lib=msvcrt")
endfunction()

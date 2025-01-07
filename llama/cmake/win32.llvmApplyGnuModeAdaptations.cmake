function(llvmApplyGnuModeAdaptations)
    # adapt cmake-js to work with llvm in GNU mode
    if (NOT CMAKE_SHARED_LINKER_FLAGS MATCHES "-Xlinker /DELAYLOAD:NODE.EXE")
        string(REPLACE "/DELAYLOAD:NODE.EXE" "-Xlinker /DELAYLOAD:NODE.EXE -Xlinker /defaultlib:delayimp"
            UPDATED_CMAKE_SHARED_LINKER_FLAGS
            "${CMAKE_SHARED_LINKER_FLAGS}")
        set(CMAKE_SHARED_LINKER_FLAGS "${UPDATED_CMAKE_SHARED_LINKER_FLAGS}" PARENT_SCOPE)
    endif()

    set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} -Xclang --dependent-lib=msvcrt" PARENT_SCOPE)
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -Xclang --dependent-lib=msvcrt" PARENT_SCOPE)
endfunction()

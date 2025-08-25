function(addVariantSuffix originalTarget variantSuffix)
    if (NOT TARGET ${originalTarget} OR variantSuffix STREQUAL "")
        return()
    endif()

    set(_name "${originalTarget}.${variantSuffix}")

    set_target_properties(${originalTarget} PROPERTIES
        OUTPUT_NAME "${_name}"
        RUNTIME_OUTPUT_NAME "${_name}" # Windows .dll
        LIBRARY_OUTPUT_NAME "${_name}" # Unix shared lib
        ARCHIVE_OUTPUT_NAME "${_name}" # static / import lib
    )

    if (APPLE)
        set_target_properties(${originalTarget} PROPERTIES
            MACOSX_RPATH     ON
            INSTALL_NAME_DIR "@rpath"
        )
    endif()
endfunction()

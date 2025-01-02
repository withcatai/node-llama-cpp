function(ensureNinjaPath)
    if ((NOT DEFINED CMAKE_MAKE_PROGRAM OR NOT EXISTS "${CMAKE_MAKE_PROGRAM}" OR NOT CMAKE_MAKE_PROGRAM) AND (CMAKE_GENERATOR STREQUAL "Ninja" OR CMAKE_GENERATOR STREQUAL "Ninja Multi-Config"))
        find_program(NINJA_EXECUTABLE ninja)

        set(CMAKE_MAKE_PROGRAM "")
        set(CMAKE_MAKE_PROGRAM "" PARENT_SCOPE)

        if(NINJA_EXECUTABLE AND EXISTS "${NINJA_EXECUTABLE}")
            set(CMAKE_MAKE_PROGRAM "${NINJA_EXECUTABLE}")
            set(CMAKE_MAKE_PROGRAM "${NINJA_EXECUTABLE}" CACHE FILEPATH "Make program")
            set(CMAKE_MAKE_PROGRAM "${NINJA_EXECUTABLE}" PARENT_SCOPE)
        endif()

        if (NOT CMAKE_MAKE_PROGRAM OR NOT EXISTS "${CMAKE_MAKE_PROGRAM}")
            set(PROGRAMDATA_PATH "$ENV{ProgramData}")
            file(TO_CMAKE_PATH "${PROGRAMDATA_PATH}" PROGRAMDATA_PATH)

            if (PROGRAMDATA_PATH AND EXISTS "${PROGRAMDATA_PATH}")
                file(GLOB_RECURSE FOUND_NINJA_EXE "${PROGRAMDATA_PATH}/chocolatey/bin/ninja.exe")

                if(FOUND_NINJA_EXE)
                    list(GET FOUND_NINJA_EXE 0 FOUND_CMAKE_MAKE_PROGRAM)
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}")
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}" CACHE FILEPATH "Make program")
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}" PARENT_SCOPE)
                endif()
            endif()
        endif()

        if (NOT CMAKE_MAKE_PROGRAM OR NOT EXISTS "${CMAKE_MAKE_PROGRAM}")
            set(LOCALAPPDATA_PATH "$ENV{LOCALAPPDATA}")
            file(TO_CMAKE_PATH "${LOCALAPPDATA_PATH}" LOCALAPPDATA_PATH)

            if (LOCALAPPDATA_PATH AND EXISTS "${LOCALAPPDATA_PATH}")
                file(GLOB_RECURSE FOUND_NINJA_EXE "${LOCALAPPDATA_PATH}/Microsoft/WinGet/Packages/Ninja-build.Ninja_Microsoft.Winget.*/ninja.exe")

                if(FOUND_NINJA_EXE)
                    list(GET FOUND_NINJA_EXE 0 FOUND_CMAKE_MAKE_PROGRAM)
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}")
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}" CACHE FILEPATH "Make program")
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}" PARENT_SCOPE)
                endif()
            endif()
        endif()

        if (NOT CMAKE_MAKE_PROGRAM OR NOT EXISTS "${CMAKE_MAKE_PROGRAM}")
            foreach(PATH IN LISTS PROGRAMFILES_PATHS)
                file(GLOB_RECURSE FOUND_NINJA_EXE
                    "${PATH}/Microsoft Visual Studio/*/CMake/Ninja/ninja.exe"
                    "${PATH}/Microsoft Visual Studio/**/*/CMake/Ninja/ninja.exe"
                    "${PATH}/Microsoft Visual Studio/*/Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/ninja.exe"
                    "${PATH}/Microsoft Visual Studio/**/*/Common7/IDE/CommonExtensions/Microsoft/CMake/Ninja/ninja.exe")

                if(FOUND_NINJA_EXE)
                    list(GET FOUND_NINJA_EXE 0 FOUND_CMAKE_MAKE_PROGRAM)
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}")
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}" CACHE FILEPATH "Make program")
                    set(CMAKE_MAKE_PROGRAM "${FOUND_CMAKE_MAKE_PROGRAM}" PARENT_SCOPE)
                    break()
                endif()
            endforeach()
        endif()

        if (NOT CMAKE_MAKE_PROGRAM OR NOT EXISTS "${CMAKE_MAKE_PROGRAM}")
            message(FATAL_ERROR "Ninja build system not found. Please install Ninja or Visual Studio Build Tools.")
        endif()
    endif()
endfunction()

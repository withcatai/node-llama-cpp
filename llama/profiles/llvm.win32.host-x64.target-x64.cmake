include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.programFilesPaths.cmake")
setProgramFilesPaths("x64")

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.ensureNodeLib.cmake")
ensureNodeLib("x64" "x64")

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.llvmApplyGnuModeAdaptations.cmake")
llvmApplyGnuModeAdaptations()

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.llvmEnsureCmakeAr.cmake")
llvmEnsureCmakeAr("x64")

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.ensureNinjaPath.cmake")
ensureNinjaPath()

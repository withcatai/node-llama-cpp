include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.programFilesPaths.cmake")
setProgramFilesPaths("arm64")

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.ensureNodeLib.cmake")
ensureNodeLib("arm64" "arm64")

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.llvmApplyGnuModeAdaptations.cmake")
llvmApplyGnuModeAdaptations()

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.llvmEnsureCmakeAr.cmake")
llvmEnsureCmakeAr("arm64")

include("${CMAKE_CURRENT_LIST_DIR}/../cmake/win32.ensureNinjaPath.cmake")
ensureNinjaPath()

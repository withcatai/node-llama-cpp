include(../cmake/win32.programFilesPaths.cmake)
setProgramFilesPaths("x64" PROGRAMFILES_PATHS)

include(../cmake/win32.ensureNodeLib.cmake)
ensureNodeLib(PROGRAMFILES_PATHS "x64" "arm64")

include(../cmake/win32.llvmApplyGnuModeAdaptations.cmake)
llvmApplyGnuModeAdaptations()

include(../cmake/win32.llvmEnsureCmakeAr.cmake)
llvmEnsureCmakeAr(PROGRAMFILES_PATHS "x64")

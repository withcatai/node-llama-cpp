---
description: Tips and tricks for using node-llama-cpp
---
# Tips and Tricks
## OpenMP {#openmp}
> OpenMP is an API for parallel programming in shared-memory systems

OpenMP can help improve inference performance on Linux and Windows, but requires additional installation and setup.

The performance improvement can be [up to 8% faster](https://github.com/ggml-org/llama.cpp/pull/7606) inference times (on specific conditions).
Setting the `OMP_PROC_BIND` environment variable to `TRUE` on systems that support many threads (assume 36 as the minimum) can improve performance [by up to 23%](https://github.com/ggml-org/llama.cpp/pull/7606).

The pre-built binaries are compiled without OpenMP since OpenMP isn't always available on all systems, and has to be installed separately.

**macOS:** OpenMP isn't beneficial on macOS as it doesn't improve the performance. Do not attempt to install it on macOS.

**Windows:** The installation of [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-microsoft-visual-c-redistributable-version) comes with OpenMP built-in.

**Linux:** You have to manually install OpenMP:
```shell
sudo apt update
sudo apt install libgomp1
```

After installing OpenMP, [build from source](./building-from-source.md) and the OpenMP library will be automatically be used upon detection:
```shell
npx --no node-llama-cpp source download
```

Now, just use `node-llama-cpp` as you normally would.

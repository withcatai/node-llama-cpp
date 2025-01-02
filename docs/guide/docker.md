---
outline: [2, 4]
description: Using node-llama-cpp in Docker
---
# Using `node-llama-cpp` in Docker
When using `node-llama-cpp` in a docker image to run it with [Docker](https://www.docker.com) or [Podman](https://podman.io), you will most likely want to use it together with a GPU for fast inference.

For that, you'll have to:
1. Configure support for your GPU on the host machine
2. Build an image with the necessary GPU libraries
3. Enable GPU support when running the container

## Configuring the Host Machine
**Metal:** Using Metal in of a docker container is not supported.

**CUDA:** You need to install the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#installation) on the host machine to use NVIDIA GPUs.

**Vulkan:** You need to install the relevant GPU drives on the host machine, and configure [Docker](https://www.docker.com) or [Podman](https://podman.io) to use them.

**No GPU (CPU only):** No special configuration is needed.

## Building an Image
::: warning
Do not attempt to use `alpine` as the base image as it doesn't work well with many GPU drivers.

The potential image size savings of using `alpine` images are not worth the hassle,
especially considering that the models files you use will likely be much larger than the image itself anyway.
:::


::: code-group
```Dockerfile [CUDA]
FROM node:22

# Replace `x86_64` with `sbsa` for ARM64
ENV NVARCH=x86_64
ENV INSTALL_CUDA_VERSION=12.5

SHELL ["/bin/bash", "-c"]
RUN apt-get update && \
    apt-get install -y --no-install-recommends gnupg2 curl ca-certificates && \
    curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/${NVARCH}/3bf863cc.pub | apt-key add - && \
    echo "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/${NVARCH} /" > /etc/apt/sources.list.d/cuda.list && \
    apt-get purge --autoremove -y curl && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    "cuda-cudart-${INSTALL_CUDA_VERSION//./-}" \
    "cuda-compat-${INSTALL_CUDA_VERSION//./-}" \
    "cuda-libraries-${INSTALL_CUDA_VERSION//./-}" \
    "libnpp-${INSTALL_CUDA_VERSION//./-}" \
    "cuda-nvtx-${INSTALL_CUDA_VERSION//./-}" \
    "libcusparse-${INSTALL_CUDA_VERSION//./-}" \
    "libcublas-${INSTALL_CUDA_VERSION//./-}" \
    git cmake clang libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN apt-mark hold "libcublas-${INSTALL_CUDA_VERSION//./-}"

RUN echo "/usr/local/nvidia/lib" >> /etc/ld.so.conf.d/nvidia.conf \
    && echo "/usr/local/nvidia/lib64" >> /etc/ld.so.conf.d/nvidia.conf

ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=all


RUN mkdir -p /opt/app
WORKDIR /opt/app
COPY . /opt/app

RUN npm ci

CMD npm start
```
```Dockerfile [Vulkan]
FROM node:22

SHELL ["/bin/bash", "-c"]
RUN apt-get update && \
    apt-get install -y --no-install-recommends mesa-vulkan-drivers libegl1 git cmake clang libgomp1 && \
    rm -rf /var/lib/apt/lists/*

ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=all


RUN mkdir -p /opt/app
WORKDIR /opt/app
COPY . /opt/app

RUN npm ci

CMD npm start
```
```Dockerfile [No GPU <span style="opacity: 0.4">(CPU only)</span>]
FROM node:22

SHELL ["/bin/bash", "-c"]
RUN apt-get update && \
    apt-get install -y --no-install-recommends git cmake clang libgomp1 && \
    rm -rf /var/lib/apt/lists/*


RUN mkdir -p /opt/app
WORKDIR /opt/app
COPY . /opt/app

RUN npm ci

CMD npm start
```
:::

## Running the Container
To run the container with GPU support, use the following:
::: code-group
```shell[<code>docker</code> CLI]
docker run --rm -it --gpus=all my-image:tag
```
```shell[<code>podman</code> CLI]
podman run --rm -it --gpus=all my-image:tag
```
```yaml[<code>docker-compose.yml</code>]
services:
  my-service:
    image: my-image:tag
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
              count: all
```
:::

When using the CLI, you can test the GPU support by running this command
::: code-group
```shell[<code>docker</code> CLI]
docker run --rm -it --gpus=all my-image:tag npx -y node-llama-cpp inspect gpu
```
```shell[<code>podman</code> CLI]
podman run --rm -it --gpus=all my-image:tag npx -y node-llama-cpp inspect gpu
```
:::

## Troubleshooting
### NVIDIA GPU Is Not Recognized by the Vulkan Driver Inside the Container
Make sure your [Docker](https://www.docker.com)/[Podman](https://podman.io) configuration has an `nvidia` runtime:
::: code-group
```json[Docker <code>/etc/docker/daemon.json</code>]
{
    "runtimes": {
        "nvidia": {
            "args": [],
            "path": "nvidia-container-runtime"
        }
    }
}
```
```shell[Podman]
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
nvidia-ctk cdi list
```
:::

And then run the container with the `nvidia` runtime:
::: code-group
```shell[<code>docker</code> CLI]
docker run --rm -it --runtime=nvidia --gpus=all my-image:tag
```
```shell[<code>podman</code> CLI]
podman run --rm -it --device nvidia.com/gpu=all --security-opt=label=disable --gpus=all my-image:tag
```
:::

### Getting an `system has unsupported display driver / cuda driver combination` Error
Ensure that the `INSTALL_CUDA_VERSION` in the Dockerfile matches
or is older than the CUDA version installed on the host machine.

> You can check what is the installed CUDA version using `nvidia-smi --version`.

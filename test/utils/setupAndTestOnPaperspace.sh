#!/bin/bash

# Setup a machine on Paperspace, clone a repo, checkout a branch and run all tests on it.
# This is useful to make sure that everything is working on a machine with an Nvidia GPU with enough VRAM.
# Intended to run on Ubuntu 22.04.
#
# Run this script with this command:
# bash -c "$(curl -fsSL https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/test/utils/setupAndTestOnPaperspace.sh)"

installationCommand='bash -c "$(curl -fsSL https://raw.githubusercontent.com/withcatai/node-llama-cpp/master/test/utils/setupAndTestOnPaperspace.sh)"'

defaultRepo="withcatai/node-llama-cpp"
targetFolder="$HOME/workspace/test-node-llama-cpp"
nodejsVersion="20"


colorYellow=$'\e[33m'
colorBlue=$'\e[34m'
colorGray=$'\e[90m'
colorMagenta=$'\e[35m'
colorRed=$'\e[31m'
colorEnd=$'\e[0m'


# Only setup the machine if the target folder doesn't exist
if [ ! -d "$targetFolder" ]; then
    # Ensure that running on Ubuntu 22.04
    if [ ! -f /etc/os-release ] || ! grep -q 'NAME="Ubuntu"' /etc/os-release || ! grep -q 'VERSION_ID="22.04"' /etc/os-release || ! which apt>/dev/null; then
        echo "This script is intended to run on Ubuntu 22.04"
        read -r -n 1 -p "${colorYellow}Are you sure you want to continue?${colorEnd} ${colorGray}(y/n)${colorEnd} " continueScript
        if [[ ! $continueScript =~ ^[Yy]$ ]]; then
            echo "Aborting script..."
            exit 1
        fi
    fi

    # Ensure that running on Paperspace
    if [ "$USER" != "paperspace" ]; then
        echo "This script is intended to run on Paperspace"
        echo "${colorRed}It's not recommended to run it on your local machine as it will install and remove packages and change settings. It may ruin your machine.${colorEnd}"
        read -r -n 1 -p "${colorYellow}Are you sure you want to continue?${colorEnd} ${colorGray}(y/n)${colorEnd} " continueScript
        if [[ ! $continueScript =~ ^[Yy]$ ]]; then
            echo "Aborting script..."
            exit 1
        fi
    fi

    echo "Setting things up..."

    # Prevent the annoying restart services prompt from appearing
    sudo mkdir -p /etc/needrestart/conf.d
    echo '$nrconf{restart} = '\''a'\'';' | sudo tee /etc/needrestart/conf.d/no-restart-services-prompt.conf >/dev/null

    # Prevent the machine from upgrading itself for the short time it lives for this script, as it's completely unnecessary and time wasting.
    sudo apt remove -y -qq unattended-upgrades>/dev/null 2>&1

    # Install dependencies
    sudo apt update -qq>/dev/null 2>&1
    sudo apt install -y -qq git git-lfs fzf>/dev/null 2>&1


    # Receive input from the user regarding the repo and branch to clone and checkout
    read -r -p "${colorYellow}GitHub repo to clone:${colorEnd} ${colorGray}($defaultRepo)${colorEnd} " githubRepo
    githubRepo=${githubRepo:-$defaultRepo}

    githubRepoAvailableBranches=$(git ls-remote --heads https://github.com/$githubRepo | cut -d/ -f3-)
    githubRepoBranch=$(echo "$githubRepoAvailableBranches" | fzf --prompt="${colorYellow}Branch to checkout:${colorEnd} ")
    echo "${colorYellow}Branch to checkout:${colorEnd} $githubRepoBranch"

    if [ -z "$githubRepoBranch" ]; then
        echo "No branch selected. Aborting script..."
        exit 1
    fi


    # Clone the repo and checkout the branch
    echo "Cloning ${colorBlue}$githubRepo${colorEnd} and checking out ${colorBlue}$githubRepoBranch${colorEnd}..."
    echo ""
    rm -rf "$targetFolder"
    mkdir -p "$(dirname "$targetFolder")"
    git clone "https://github.com/$githubRepo" "$targetFolder"
    pushd "$targetFolder" || exit 1
    git checkout "$githubRepoBranch"
    popd || exit 1
    echo ""
    echo ""

    # Setup the machine
    echo "Setting up the machine..."
    echo "It'll take about 20 minutes to complete"
    echo ""
    echo ""
    sleep 4s
    sudo apt install -y -qq ca-certificates curl gnupg libvulkan-dev zsh

    # Install zsh
    CHSH=no RUNZSH=no sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)">/dev/null
    sudo chsh -s "$(which zsh)"
    sudo chsh -s "$(which zsh)" "$USER"

    if [ ! -f "$HOME/.zsh_history" ]; then
        echo "$installationCommand" > "$HOME/.zsh_history"
    fi

    # Add Node.js repository
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${nodejsVersion}.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list

    # Add Vulkan repository
    wget -qO - https://packages.lunarg.com/lunarg-signing-key-pub.asc | sudo apt-key add -
    sudo wget -qO /etc/apt/sources.list.d/lunarg-vulkan-jammy.list https://packages.lunarg.com/vulkan/lunarg-vulkan-jammy.list

    # Add Nvidia repository
    mkdir -p "$targetFolder/.tempMachineSetup"
    pushd "$targetFolder/.tempMachineSetup" || exit 1
    wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
    sudo dpkg -i cuda-keyring_1.1-1_all.deb
    popd || exit 1
    rm -rf "$targetFolder/.tempMachineSetup"

    # Install dependencies
    sudo apt update -qq
    sudo apt install -y -qq nodejs
    sudo apt install -y -qq vulkan-sdk
    sudo apt install -y -qq cuda-toolkit-12-3
    sudo apt install -y -qq cuda-drivers

    # Run npm install and prepare repo
    echo "Preparing the repo..."
    pushd "$targetFolder" || exit 1
    npm install
    npm run --silent dev:setup
    popd || exit 1

    if ! nvidia-smi>/dev/null; then
        echo "Reboot is needed to use the Nvidia driver after installation"
        echo "After reboot, run this script again to continue from where it left off"
        echo "It should take about 2 minutes to reboot"
        echo "Rebooting in 5 seconds..."
        sleep 5s
        sudo reboot
    fi
fi

if ! nvidia-smi>/dev/null; then
    echo "Nvidia driver is not working. Aborting script..."
    exit 1
fi

if [ -z "$(vulkaninfo 2>&1 | grep -i "deviceName")" ]; then
    echo "Vulkan is not working. Aborting script..."
    exit 1
fi

pushd "$targetFolder" || exit 1
git pull

# Run tests and start a loop of running tests and pulling from git
echo "Starting a loop of: "
echo "${colorMagenta}1.${colorEnd} Running ${colorBlue}npm install && npm run dev:setup:downloadAllTestModels${colorEnd}"
echo "${colorMagenta}2.${colorEnd} Running ${colorBlue}npm run dev:build${colorEnd} for CUDA and Vulkan"
echo "${colorMagenta}3.${colorEnd} Running ${colorBlue}npm test${colorEnd} for CUDA and Vulkan"
echo "${colorMagenta}4.${colorEnd} Waiting for the user to press Enter..."
echo "${colorMagenta}5.${colorEnd} Running ${colorBlue}git pull${colorEnd}"
echo ""

while true; do
    npm install
    npm run --silent dev:setup:downloadAllTestModels

    echo "Building for CUDA..."
    NODE_LLAMA_CPP_GPU=cuda npm run --silent dev:build

    echo "Building for Vulkan..."
    NODE_LLAMA_CPP_GPU=vulkan npm run --silent dev:build

    node ./dist/cli/cli.js inspect gpu

    echo "Running tests using CUDA..."
    NODE_LLAMA_CPP_GPU=cuda npm run --silent test

    echo "Running tests using Vulkan..."
    NODE_LLAMA_CPP_GPU=vulkan npm run --silent test

    echo ""
    echo "Done running tests"

    echo ""
    node ./dist/cli/cli.js inspect gpu
    echo ""

    read -r -s -p "${colorYellow}Press Enter to ${colorBlue}git pull${colorYellow} and rerun the tests, or Ctrl+C to exit${colorEnd}"
    git pull
done

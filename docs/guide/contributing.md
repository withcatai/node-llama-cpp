---
outline: deep
description: Contributing to node-llama-cpp
---
# Opening a PR on `node-llama-cpp`
This document describes the guidelines of how to open a PR on the `node-llama-cpp` project.

## Development
To set up your development environment, read the [development guide](./development.md).

## Commit Message Guidelines {#commit}

This repository has very precise rules over how git commit messages can be formatted.
This leads to **more readable messages** that are easy to follow when looking through the **project history**.
But also, git commit messages as used to **generate changelog**.

### Commit Message Format
Each commit message consists of a **header**, a **body** and a **footer**.
The header has a special format that includes a **type** and a **subject**:

```
<type>: <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

Any line of the commit message cannot be longer 100 characters!
This allows the message to be easier to read on GitHub as well as in various git tools.

### Revert
If the commit reverts a previous commit, it should begin with `revert: `, followed by the header of the reverted commit.
In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

### Type
Must be one of the following:

* **feat**: A new feature
* **fix**: A bug fix
* **docs**: Documentation only changes
* **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
* **refactor**: A code change that neither fixes a bug nor adds a feature
* **perf**: A code change that improves performance
* **test**: Adding missing tests or correcting existing tests
* **build**: Changes that affect the build system, CI configuration or external dependencies
* **chore**: Other changes that don't modify `src` or `test` files

### Subject
The subject contains a succinct description of the change:

* use the imperative, present tense: "change" not "changed" nor "changes"
* don't capitalize the first letter
* no dot (.) at the end

### Body
Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes".
The body should include the motivation for the change and contrast this with the previous behavior.

### Footer
The footer should contain any information about **Breaking Changes**
and is also the place to reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the text `BREAKING CHANGE:` with a space or two newlines.
The rest of the commit message is then used for this.

### Examples
Fix and close issue:
```
fix: resolve issues with model loading

Closes: #123456
```
Implement new feature:
```
feat: support more model types

This new feature adds support for importing model types 1, 2, and 3.

Closes: #22222
```
Docs update:
```
docs: update documentation for the `prompt` function
```
Breaking change:
```
refactor: refactor the function `prompt`

BREAKING CHANGE: description of breaking change in `prompt`
```

## PR Title Guidelines
The title of the PR should be `<type>: <subject>` as described in the [Commit Message Guidelines](#commit).

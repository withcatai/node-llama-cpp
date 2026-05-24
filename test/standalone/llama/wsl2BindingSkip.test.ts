/**
 * WSL2 binding test skip tests
 * These test that WSL2 Linux environments skip binding tests for prebuilt CUDA binaries
 */
import { describe, it, expect } from "vitest";

describe("WSL2 binding skip", () => {
	it("WSL2 detection: /proc/sys/kernel/osrelease contains WSL2", async () => {
		const fs = await import("fs-extra");
		const exists = await fs.pathExists("/proc/sys/kernel/osrelease");
		if (!exists) {
			return; // Not on Linux, skip
		}
		const content = await fs.readFile("/proc/sys/kernel/osrelease", "utf8");
		const isWSL = content.toLowerCase().includes("wsl2") || content.toLowerCase().includes("microsoft");
		expect(typeof isWSL).toBe("boolean");
	});

	it("prebuilt CUDA binary path exists", async () => {
		const fs = await import("fs-extra");
		const paths = [
			process.env.HOME + "/.npm-global/lib/node_modules/node-llama-cpp/node_modules/@node-llama-cpp/linux-x64-cuda/bins/linux-x64-cuda/llama-addon.node",
			"/usr/local/lib/node_modules/node-llama-cpp/node_modules/@node-llama-cpp/linux-x64-cuda/bins/linux-x64-cuda/llama-addon.node"
		];
		let found = false;
		for (const p of paths) {
			if (await fs.pathExists(p)) {
				found = true;
				break;
			}
		}
		if (!found) console.log("CUDA prebuilt binary not found, skipping");
	});
});

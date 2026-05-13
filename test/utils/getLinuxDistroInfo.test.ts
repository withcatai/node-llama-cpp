import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs-extra";
import { getLinuxDistroInfo } from "../../src/bindings/utils/getLinuxDistroInfo.js";

const mockExists = vi.spyOn(fs, "pathExists");
const mockReadFile = vi.spyOn(fs, "readFile");

describe("getLinuxDistroInfo", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns wslDistro true when kernel release contains WSL2", async () => {
		mockExists.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return true;
			if (path === "/proc/sys/kernel/osrelease") return true;
			return false;
		});
		mockReadFile.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return `PRETTY_NAME="Ubuntu 24.04 LTS"\nID=ubuntu\nVERSION_ID="24.04"\n`;
			if (path === "/proc/sys/kernel/osrelease") return "6.6.114.1-microsoft-standard-WSL2";
			return "";
		});

		const result = await getLinuxDistroInfo();
		expect(result.wslDistro).toBe(true);
		expect(result.name).toBe("Ubuntu");
	});

	it("returns wslDistro true when kernel release contains Microsoft", async () => {
		mockExists.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return true;
			if (path === "/proc/sys/kernel/osrelease") return true;
			return false;
		});
		mockReadFile.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return `PRETTY_NAME="Ubuntu 22.04 LTS"\nID=ubuntu\nVERSION_ID="22.04"\n`;
			if (path === "/proc/sys/kernel/osrelease") return "5.15.153.1-microsoft-standard-WSL2";
			return "";
		});

		const result = await getLinuxDistroInfo();
		expect(result.wslDistro).toBe(true);
	});

	it("returns wslDistro false when kernel release does not contain WSL2 or Microsoft", async () => {
		mockExists.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return true;
			if (path === "/proc/sys/kernel/osrelease") return true;
			return false;
		});
		mockReadFile.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return `PRETTY_NAME="Ubuntu 24.04 LTS"\nID=ubuntu\nVERSION_ID="24.04"\n`;
			if (path === "/proc/sys/kernel/osrelease") return "6.8.0-49-generic";
			return "";
		});

		const result = await getLinuxDistroInfo();
		expect(result.wslDistro).toBe(false);
		expect(result.name).toBe("Ubuntu");
	});

	it("returns wslDistro false when /proc/sys/kernel/osrelease does not exist", async () => {
		mockExists.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return true;
			if (path === "/proc/sys/kernel/osrelease") return false;
			return false;
		});
		mockReadFile.mockImplementation(async (path: string) => {
			if (path === "/etc/os-release") return `PRETTY_NAME="Ubuntu 24.04 LTS"\nID=ubuntu\nVERSION_ID="24.04"\n`;
			return "";
		});

		const result = await getLinuxDistroInfo();
		expect(result.wslDistro).toBe(false);
	});
});

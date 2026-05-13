import { describe, it, expect, vi } from "vitest";
import { getPlatformInfo } from "../../src/bindings/utils/getPlatformInfo.js";
import * as getLinuxDistroInfo from "../../src/bindings/utils/getLinuxDistroInfo.js";

vi.mock("../../src/bindings/utils/getLinuxDistroInfo.js");

describe("getPlatformInfo", () => {
	it("propagates wslDistro from linuxDistroInfo", async () => {
		vi.spyOn(getLinuxDistroInfo, "getLinuxDistroInfo").mockResolvedValue({
			name: "Ubuntu",
			id: "ubuntu",
			version: "24.04",
			versionCodename: "noble",
			prettyName: "Ubuntu 24.04 LTS",
			wslDistro: true
		});

		const result = await getPlatformInfo();
		expect(result.wslDistro).toBe(true);
		expect(result.name).toBe("Ubuntu");
	});

	it("does not include wslDistro field when not WSL2", async () => {
		vi.spyOn(getLinuxDistroInfo, "getLinuxDistroInfo").mockResolvedValue({
			name: "Ubuntu",
			id: "ubuntu",
			version: "24.04",
			versionCodename: "noble",
			prettyName: "Ubuntu 24.04 LTS",
			wslDistro: false
		});

		const result = await getPlatformInfo();
		expect(result.wslDistro).toBeUndefined();
		expect(result.name).toBe("Ubuntu");
	});
});

export function detectCurrentPackageManager(): "npm" | "bun" | "pnpm" | "deno" | "yarn" | undefined {
    const userAgent = (process.env["npm_config_user_agent"] ?? "").toLowerCase();

    if (userAgent.startsWith("bun/"))
        return "bun";
    else if (userAgent.startsWith("pnpm/"))
        return "pnpm";
    else if (userAgent.startsWith("yarn/"))
        return "yarn";
    else if (userAgent.startsWith("deno/"))
        return "deno";
    else if (userAgent.startsWith("npm/"))
        return "npm";

    return undefined;
}

import ora from "ora";

export default async function withOra<T>(
    message: string | {
        loading: string,
        success?: string,
        fail?: string,
    },
    callback: () => Promise<T>
): Promise<T> {
    const spinner = ora(typeof message === "string" ? message : message.loading);

    spinner.start();

    try {
        const res = await callback();

        if (typeof message !== "string")
            spinner.succeed(message.success);
        else
            spinner.succeed();

        return res;
    } catch (er) {
        if (typeof message !== "string")
            spinner.fail(message.fail);
        else
            spinner.fail();

        throw er;
    }
}

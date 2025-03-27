import {describe, expect, test} from "vitest";
import {optionsMatrix, tryMatrix} from "../../../src/utils/optionsMatrix.js";


describe("utils", () => {
    describe("optionsMatrix", () => {
        test("2 parameters", () => {
            expect(
                Array.from(optionsMatrix({
                    a: [1, 2],
                    b: [3, 4]
                }))
            ).to.eql([
                {a: 1, b: 3},
                {a: 1, b: 4},
                {a: 2, b: 3},
                {a: 2, b: 4}
            ]);
        });
        test("2 parameters - different lengths", () => {
            expect(
                Array.from(optionsMatrix({
                    a: [1, 2, 3],
                    b: [4]
                }))
            ).to.eql([
                {a: 1, b: 4},
                {a: 2, b: 4},
                {a: 3, b: 4}
            ]);
        });
        test("2 parameters - different lengths 2", () => {
            expect(
                Array.from(optionsMatrix({
                    a: [1],
                    b: [2, 3, 4]
                }))
            ).to.eql([
                {a: 1, b: 2},
                {a: 1, b: 3},
                {a: 1, b: 4}
            ]);
        });
        test("1 parameter", () => {
            expect(
                Array.from(optionsMatrix({
                    a: [1, 2]
                }))
            ).to.eql([
                {a: 1},
                {a: 2}
            ]);
        });
        test("no parameters", () => {
            expect(
                Array.from(optionsMatrix({}))
            ).to.eql([
                {}
            ]);
        });
    });

    describe("tryMatrix", () => {
        test("2 parameter", () => {
            const options: {a: number, b: number}[] = [];
            const result = tryMatrix({
                a: [1, 2],
                b: [3, 4]
            }, ({a, b}) => {
                options.push({a, b});
                if (a === 2 && b === 4)
                    return `success ${a} ${b}`;

                throw new Error("fail");
            });

            expect(result).to.eql("success 2 4");
            expect(options).to.eql([
                {a: 1, b: 3},
                {a: 1, b: 4},
                {a: 2, b: 3},
                {a: 2, b: 4}
            ]);
        });

        test("2 parameter - stop in the middle", () => {
            const options: {a: number, b: number}[] = [];
            const result = tryMatrix({
                a: [1, 2],
                b: [3, 4]
            }, ({a, b}) => {
                options.push({a, b});
                if (a === 2 && b === 3)
                    return `success ${a} ${b}`;

                throw new Error("fail");
            });

            expect(result).to.eql("success 2 3");
            expect(options).to.eql([
                {a: 1, b: 3},
                {a: 1, b: 4},
                {a: 2, b: 3}
            ]);
        });

        test("no iterations", () => {
            const options: {a: number, b: number}[] = [];
            const result = tryMatrix({
                a: [1, 2],
                b: [3, 4]
            }, ({a, b}) => {
                options.push({a, b});
                if (a === 1 && b === 3)
                    return `success ${a} ${b}`;

                throw new Error("fail");
            });

            expect(result).to.eql("success 1 3");
            expect(options).to.eql([
                {a: 1, b: 3}
            ]);
        });

        test("no options - success", () => {
            const result = tryMatrix({}, ({}) => {
                return "success";
            });

            expect(result).to.eql("success");
        });

        test("no options - fail", () => {
            try {
                tryMatrix({}, ({}) => {
                    throw new Error("fail");
                });
                expect.unreachable("Should have thrown an error");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: fail]");
            }
        });

        test("throw on all options", () => {
            const options: {a: number, b: number}[] = [];
            try {
                tryMatrix({
                    a: [1, 2],
                    b: [3, 4]
                }, ({a, b}) => {
                    options.push({a, b});
                    throw new Error(`fail ${a} ${b}`);
                });
                expect.unreachable("Should have thrown an error");
            } catch (err) {
                expect(err).toMatchInlineSnapshot("[Error: fail 2 4]");
            }

            expect(options).to.eql([
                {a: 1, b: 3},
                {a: 1, b: 4},
                {a: 2, b: 3},
                {a: 2, b: 4}
            ]);
        });
    });
});

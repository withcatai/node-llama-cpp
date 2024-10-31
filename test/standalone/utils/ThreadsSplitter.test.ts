import {describe, expect, test} from "vitest";
import {ThreadsSplitter} from "../../../src/utils/ThreadsSplitter.js";


describe("utils", () => {
    describe("ThreadsSplitter", () => {
        test("threads splitting properly", async () => {
            const threadSplitter = new ThreadsSplitter(8);

            expect(threadSplitter.maxThreads).toBe(8);
            const consumer1 = threadSplitter.createConsumer(8, 1);

            const [allocation1, handle1] = await consumer1.getAllocationToConsume();
            expect(allocation1).toBe(8);

            const consumer2 = threadSplitter.createConsumer(8, 1);
            const allocationPromise = consumer2.getAllocationToConsume();
            let allocationPromiseResolved = false;
            Promise.resolve(allocationPromise).then(() => {
                allocationPromiseResolved = true;
            });
            await new Promise((resolve) => setTimeout(resolve, 0));
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(allocationPromiseResolved).toBe(false);

            handle1.dispose();
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(allocationPromiseResolved).toBe(true);

            const [allocation2, handle2] = await allocationPromise;
            expect(allocation2).toBe(4);

            handle2.dispose();

            const [allocation3, handle3] = await consumer1.getAllocationToConsume();
            expect(allocation3).toBe(4);
            handle3.dispose();

            consumer1.dispose();

            const [allocation4, handle4] = await consumer2.getAllocationToConsume();
            expect(allocation4).toBe(8);
            handle4.dispose();

            consumer2.dispose();
        });

        test("min threads works", async () => {
            const threadSplitter = new ThreadsSplitter(8);

            expect(threadSplitter.maxThreads).toBe(8);
            const consumer1 = threadSplitter.createConsumer(4, 1);

            const [allocation1, handle1] = await consumer1.getAllocationToConsume();
            expect(allocation1).toBe(4);

            const consumer2 = threadSplitter.createConsumer(2, 1);
            const [allocation2, handle2] = await consumer2.getAllocationToConsume();
            expect(allocation2).toBe(2);

            const consumer3 = threadSplitter.createConsumer(8, 5);
            const allocationPromise = consumer3.getAllocationToConsume();
            let allocationPromiseResolved = false;
            Promise.resolve(allocationPromise).then(() => {
                allocationPromiseResolved = true;
            });
            await new Promise((resolve) => setTimeout(resolve, 0));
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(allocationPromiseResolved).toBe(false);

            handle1.dispose();
            consumer1.dispose();

            await new Promise((resolve) => setTimeout(resolve, 0));
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(allocationPromiseResolved).toBe(true);

            const [allocation3, handle3] = await allocationPromise;
            expect(allocation3).toBe(6);
            handle3.dispose();

            handle2.dispose();

            const [allocation4, handle4] = await consumer3.getAllocationToConsume();
            expect(allocation4).toBe(7);
            handle4.dispose();

            const [allocation5, handle5] = await consumer2.getAllocationToConsume();
            expect(allocation5).toBe(1);
            handle5.dispose();

            consumer2.dispose();

            const [allocation6, handle6] = await consumer3.getAllocationToConsume();
            expect(allocation6).toBe(8);
            handle6.dispose();
        });
    });
});

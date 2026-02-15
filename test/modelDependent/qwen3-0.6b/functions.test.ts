import {describe, expect, test} from "vitest";
import {
    defineChatSessionFunction, JinjaTemplateChatWrapper, LlamaChatSession, QwenChatWrapper, resolveChatWrapper
} from "../../../src/index.js";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";

describe("qwen3 0.6b", () => {
    describe("functions", () => {
        test("get n-th word", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3-0.6B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 1024
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });
            expect(chatSession.chatWrapper).to.be.instanceof(QwenChatWrapper);

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                }
                            }
                        },
                        handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("What is the second word? No yapping, no formatting", {
                ...promptOptions,
                maxTokens: 250,
                budgets: {
                    thoughtTokens: 100
                }
            });

            expect(res.trim()).to.be.eq('The second word is "secret".');

            const res2 = await chatSession.prompt("Explain what this word means", {
                ...promptOptions,
                maxTokens: 40,
                budgets: {
                    thoughtTokens: 0
                }
            });

            expect(res2.length).to.be.greaterThan(1);
        });

        test("get n-th word using jinja template", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3-0.6B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 1024
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence(),
                chatWrapper: resolveChatWrapper(model, {
                    type: "jinjaTemplate"
                })
            });
            expect(chatSession.chatWrapper).to.be.instanceof(JinjaTemplateChatWrapper);

            const promptOptions: Parameters<typeof chatSession.prompt>[1] = {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            properties: {
                                n: {
                                    enum: [1, 2, 3, 4]
                                }
                            }
                        },
                        handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    })
                }
            } as const;

            const res = await chatSession.prompt("What is the second word? No yapping, no formatting, use the function", {
                ...promptOptions,
                maxTokens: 250,
                budgets: {
                    thoughtTokens: 100
                }
            });

            expect(res.trim()).to.be.eq('The second word is "secret".');

            const res2 = await chatSession.prompt("Explain what this word means", {
                ...promptOptions,
                maxTokens: 40,
                budgets: {
                    thoughtTokens: 0
                }
            });

            expect(res2.length).to.be.greaterThan(1);
        });

        test("$defs and $ref with recursion", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Qwen3-0.6B-Q8_0.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 1024
            });
            const chatSession = new LlamaChatSession({
                contextSequence: context.getSequence()
            });
            expect(chatSession.chatWrapper).to.be.instanceof(QwenChatWrapper);

            const promptOptions = {
                functions: {
                    getNthWord: defineChatSessionFunction({
                        description: "Get an n-th word",
                        params: {
                            type: "object",
                            $defs: {
                                nthWord: {
                                    enum: [1, 2, 3, 4]
                                }
                            },
                            properties: {
                                n: {
                                    $ref: "#/$defs/nthWord"
                                }
                            }
                        },
                        handler(params) {
                            return ["very", "secret", "this", "hello"][params.n - 1];
                        }
                    }),
                    notifyOwner: defineChatSessionFunction({
                        description: "Send a notification to the owner, and create sub notifications",
                        params: {
                            $ref: "#/$defs/notification",
                            $defs: {
                                notification: {
                                    type: "object",
                                    properties: {
                                        message: {
                                            type: "string"
                                        },
                                        subNotifications: {
                                            type: "array",
                                            items: {
                                                $ref: "#/$defs/notification"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        handler(notification) {
                            createdNotifications.push(notification);
                            return "Notification created";
                        }
                    })
                }
            } as const satisfies Parameters<typeof chatSession.prompt>[1];
            const createdNotifications: Parameters<typeof promptOptions["functions"]["notifyOwner"]["handler"]>[0][] = [];

            const res = await chatSession.prompt("What is the second word? No yapping, no formatting", {
                ...promptOptions,
                maxTokens: 250,
                budgets: {
                    thoughtTokens: 100
                }
            });

            expect(res.trim()).to.be.eq('The second word is "secret".');

            const res2 = await chatSession.prompt([
                "The owner has 3 apps: App1, App2, and App3.",
                "Notify the owner with a main notifications about 'apps time', with a sub-notification for each app with the app's name.",
                "Under each app sub-notification add a sub-notification with the app's number."
            ].join("\n"), {
                ...promptOptions,
                maxTokens: 200,
                budgets: {
                    thoughtTokens: 0
                }
            });

            expect(res2.length).to.be.greaterThan(1);
            expect(createdNotifications).toMatchInlineSnapshot(`
              [
                {
                  "message": "apps time",
                  "subNotifications": [
                    {
                      "message": "App1",
                      "subNotifications": [
                        {
                          "message": "1. App1 sub notification 1",
                          "subNotifications": [],
                        },
                      ],
                    },
                    {
                      "message": "App2",
                      "subNotifications": [
                        {
                          "message": "2. App2 sub notification 2",
                          "subNotifications": [],
                        },
                      ],
                    },
                    {
                      "message": "App3",
                      "subNotifications": [
                        {
                          "message": "3. App3 sub notification 3",
                          "subNotifications": [],
                        },
                      ],
                    },
                  ],
                },
              ]
            `);
        });
    });
});

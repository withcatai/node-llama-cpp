import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {simplifyTestDecisionAnswers} from "../../utils/helpers/simplifyTestDecisionAnswerRange.js";
import {LlamaChatSession} from "../../../src/index.js";

describe("gemma4 e2b", () => {
    describe("structuredDecisions", () => {
        describe("decision context", () => {
            test("single decision", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createDecisionContext({
                    contextSize: 4096
                });

                const document = "The API is down but the servers are running";
                const res = await context.decide(document, {
                    isUrgent: {
                        type: "noul",
                        instruction: "Is it urgent?"
                    }
                });

                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "isUrgent": {
                      "_logit": [
                        [
                          "A",
                          5.901250839233398,
                        ],
                        [
                          "B",
                          -1.1891591548919678,
                        ],
                      ],
                      "type": "noul",
                      "value": 0.999,
                    },
                  }
                `);
            });

            test("multiple decisions", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createDecisionContext({
                    contextSize: 4096
                });

                const document = "The API is down";
                const res = await context.decide(document, {
                    team: {
                        type: "choice",
                        instruction: "Which team is responsible?",
                        criteria: {
                            engineering: "Engineering",
                            hr: "Human Resources",
                            sales: "Sales"
                        }
                    },
                    component: {
                        type: "choice",
                        instruction: "Which component is relevant?",
                        criteria: {
                            API: null,
                            codebase: null,
                            database: null
                        }
                    },
                    isUrgent: {
                        type: "noul",
                        instruction: "Is it urgent?",
                        criteria: {
                            true: "This should be handled immediately",
                            false: "We can address this later"
                        }
                    },
                    level: {
                        type: "score",
                        instruction: "What is the severity level?",
                        criteria: [
                            "The service is operational",
                            "The service is degraded",
                            "The service is down"
                        ]
                    }
                });

                expect(Object.keys(res)).toEqual(["team", "component", "isUrgent", "level"]);
                expect(Object.keys(res.team.probabilities)).toEqual(["engineering", "hr", "sales"]);
                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "component": {
                      "_logit": [
                        [
                          "A",
                          -3.610677480697632,
                        ],
                        [
                          "B",
                          -14.260517120361328,
                        ],
                        [
                          "C",
                          -15.707091331481934,
                        ],
                      ],
                      "choice": "API",
                      "confidence": 1,
                      "probabilities": {
                        "API": 1,
                        "codebase": 0.0000237,
                        "database": 0.00000558,
                      },
                      "type": "choice",
                    },
                    "isUrgent": {
                      "_logit": [
                        [
                          "A",
                          0.2260155975818634,
                        ],
                        [
                          "B",
                          -9.297619819641113,
                        ],
                      ],
                      "type": "noul",
                      "value": 1,
                    },
                    "level": {
                      "_logit": [
                        [
                          "C",
                          -13.569588661193848,
                        ],
                        [
                          "D",
                          -20.93646812438965,
                        ],
                        [
                          "B",
                          -22.085330963134766,
                        ],
                        [
                          "A",
                          -22.802064895629883,
                        ],
                      ],
                      "confidence": 0.999,
                      "probabilities": [
                        0.0000978,
                        0.0002,
                        1,
                      ],
                      "score": 2,
                      "type": "score",
                    },
                    "team": {
                      "_logit": [
                        [
                          "A",
                          -0.46570438146591187,
                        ],
                        [
                          "B",
                          -8.915700912475586,
                        ],
                        [
                          "C",
                          -10.698335647583008,
                        ],
                      ],
                      "choice": "engineering",
                      "confidence": 1,
                      "probabilities": {
                        "engineering": 1,
                        "hr": 0.000214,
                        "sales": 0.000036,
                      },
                      "type": "choice",
                    },
                  }
                `);
            });
        });

        describe("in a chat", () => {
            test("matching", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });
                const chat = new LlamaChatSession({
                    contextSequence: context.getSequence()
                });

                const chatResponse = await chat.prompt("Tell me about llamas and where they are from, and a related animal", {
                    maxTokens: 100,
                    budgets: {
                        thoughtTokens: 40
                    }
                });
                console.log(chatResponse);

                const res = await chat.decide({
                    animal: {
                        type: "noul",
                        instruction: "Did we talk about an animal?"
                    },
                    animalOrigins: {
                        type: "noul",
                        instruction: "Did we discuss an animal's geographic origin?",
                        criteria: {
                            true: "The conversation identifies a region where an animal comes from",
                            false: null as any
                        }
                    },
                    relatedAnimals: {
                        type: "noul",
                        instruction: "Did we connect two animals through a biological relationship?",
                        criteria: {
                            true: null as any,
                            false: "No relationship between different animals was mentioned"
                        }
                    },
                    educational: {
                        type: "noul",
                        instruction: "Was the response intended to teach the reader something?",
                        criteria: {
                            true: null as any,
                            false: null as any
                        }
                    },
                    realWorldAnimals: {
                        type: "noul",
                        instruction: "Were we discussing real animals rather than mythical creatures?",
                        criteria: {
                            true: "The animals discussed exist in the real world",
                            false: "The discussion was about imaginary or mythical animals"
                        }
                    }
                });

                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "animal": {
                      "_logit": [
                        [
                          "A",
                          -2.642641544342041,
                        ],
                        [
                          "B",
                          -12.527066230773926,
                        ],
                      ],
                      "type": "noul",
                      "value": 1,
                    },
                    "animalOrigins": {
                      "_logit": [
                        [
                          "A",
                          -3.976987838745117,
                        ],
                        [
                          "B",
                          -13.54588794708252,
                        ],
                      ],
                      "type": "noul",
                      "value": 1,
                    },
                    "educational": {
                      "_logit": [
                        [
                          "A",
                          -10.256660461425781,
                        ],
                        [
                          "B",
                          -18.809179306030273,
                        ],
                      ],
                      "type": "noul",
                      "value": 1,
                    },
                    "realWorldAnimals": {
                      "_logit": [
                        [
                          "A",
                          -8.123294830322266,
                        ],
                        [
                          "B",
                          -19.406797409057617,
                        ],
                      ],
                      "type": "noul",
                      "value": 1,
                    },
                    "relatedAnimals": {
                      "_logit": [
                        [
                          "A",
                          0.865481436252594,
                        ],
                        [
                          "B",
                          -8.339290618896484,
                        ],
                      ],
                      "type": "noul",
                      "value": 1,
                    },
                  }
                `);
            });

            test("not matching", {timeout: 1000 * 60 * 60 * 2}, async () => {
                const modelPath = await getModelFile("gemma-4-E2B-it-Q4_K_M.gguf");
                const llama = await getTestLlama();

                const model = await llama.loadModel({
                    modelPath
                });
                const context = await model.createContext({
                    contextSize: 4096
                });

                const sequence = context.getSequence();

                const chat = new LlamaChatSession({
                    contextSequence: sequence
                });

                const chatResponse = await chat.prompt("Where is wood coming from?", {
                    maxTokens: 100,
                    budgets: {
                        thoughtTokens: 40
                    }
                });
                console.log(chatResponse);

                const res = await chat.decide({
                    animal: {
                        type: "noul",
                        instruction: "Did we talk about an animal?"
                    },
                    mineralOrigin: {
                        type: "noul",
                        instruction: "Did we say wood is mined from rocks?",
                        criteria: {
                            true: "Wood was described as a mineral extracted from rock",
                            false: null as any
                        }
                    },
                    cookingRecipe: {
                        type: "noul",
                        instruction: "Did we give a recipe for cooking a meal?",
                        criteria: {
                            true: null as any,
                            false: "The response explains a material's origin without giving cooking instructions"
                        }
                    },
                    spaceTravel: {
                        type: "noul",
                        instruction: "Did we discuss a journey to another planet?",
                        criteria: {
                            true: null as any,
                            false: null as any
                        }
                    },
                    fictionalStory: {
                        type: "noul",
                        instruction: "Was the response a fictional story with characters and a plot?",
                        criteria: {
                            true: "The response tells an invented story",
                            false: "The response gives a factual explanation of where a material comes from"
                        }
                    },
                    wood: {
                        type: "noul",
                        instruction: "Did we talk about wood?"
                    },
                    subject: {
                        type: "choice",
                        instruction: "What did we talk about?",
                        criteria: {
                            materials: null,
                            food: null,
                            brushing: null,
                            other: null
                        }
                    }
                });

                expect(simplifyTestDecisionAnswers(res)).toMatchInlineSnapshot(`
                  {
                    "animal": {
                      "_logit": [
                        [
                          "B",
                          4.962754726409912,
                        ],
                        [
                          "A",
                          -1.0743200778961182,
                        ],
                      ],
                      "type": "noul",
                      "value": 0.00238,
                    },
                    "cookingRecipe": {
                      "_logit": [
                        [
                          "B",
                          -4.915587425231934,
                        ],
                        [
                          "A",
                          -15.6191987991333,
                        ],
                      ],
                      "type": "noul",
                      "value": 0.0000225,
                    },
                    "fictionalStory": {
                      "_logit": [
                        [
                          "B",
                          -13.099068641662598,
                        ],
                        [
                          "A",
                          -24.286401748657227,
                        ],
                      ],
                      "type": "noul",
                      "value": 0.0000138,
                    },
                    "mineralOrigin": {
                      "_logit": [
                        [
                          "B",
                          -14.025619506835938,
                        ],
                        [
                          "A",
                          -24.29061508178711,
                        ],
                      ],
                      "type": "noul",
                      "value": 0.0000348,
                    },
                    "spaceTravel": {
                      "_logit": [
                        [
                          "B",
                          -1.817817211151123,
                        ],
                        [
                          "A",
                          -13.12438678741455,
                        ],
                      ],
                      "type": "noul",
                      "value": 0.0000123,
                    },
                    "subject": {
                      "_logit": [
                        [
                          "A",
                          -1.7829921245574951,
                        ],
                        [
                          "D",
                          -12.703435897827148,
                        ],
                        [
                          "B",
                          -13.707768440246582,
                        ],
                        [
                          "C",
                          -14.45690631866455,
                        ],
                      ],
                      "choice": "materials",
                      "confidence": 1,
                      "probabilities": {
                        "brushing": 0.00000313,
                        "food": 0.00000662,
                        "materials": 1,
                        "other": 0.0000181,
                      },
                      "type": "choice",
                    },
                    "wood": {
                      "_logit": [
                        [
                          "A",
                          -2.336394786834717,
                        ],
                        [
                          "B",
                          -13.21182632446289,
                        ],
                      ],
                      "type": "noul",
                      "value": 1,
                    },
                  }
                `);
            });
        });
    });
});

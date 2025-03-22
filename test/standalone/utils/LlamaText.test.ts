import {describe, expect, test} from "vitest";
import {isLlamaText, LlamaText, SpecialToken, SpecialTokensText} from "../../../src/utils/LlamaText.js";


describe("utils", () => {
    describe("LlamaText", () => {
        test("instanceof", async () => {
            const text1 = LlamaText("Hi there!");
            const text2 = new LlamaText("Hi there!");
            const text3 = text1.joinValues(" ");
            const text4 = text2.joinValues(" ");

            expect(text1).to.be.instanceof(LlamaText);
            expect(text2).to.be.instanceof(LlamaText);
            expect(text3).to.be.instanceof(LlamaText);
            expect(text4).to.be.instanceof(LlamaText);

            expect(text1 instanceof LlamaText).to.eql(true);
            expect(text2 instanceof LlamaText).to.eql(true);
            expect(text3 instanceof LlamaText).to.eql(true);
            expect(text4 instanceof LlamaText).to.eql(true);

            expect(isLlamaText(text1)).to.eql(true);
            expect(isLlamaText(text2)).to.eql(true);
            expect(isLlamaText(text3)).to.eql(true);
            expect(isLlamaText(text4)).to.eql(true);

            expect(text1).toMatchInlineSnapshot(`
              LlamaText([
                "Hi there!",
              ])
            `);
            expect(text2).toMatchInlineSnapshot(`
              LlamaText([
                "Hi there!",
              ])
            `);

            expect(text1.toJSON()).toMatchInlineSnapshot('"Hi there!"');
            expect(text2.toJSON()).toMatchInlineSnapshot('"Hi there!"');
        });

        test("squash texts", async () => {
            const text = LlamaText([
                "Hi ",
                "there!",
                new SpecialTokensText("Special"),
                new SpecialTokensText(" text"),
                new SpecialToken("EOS")
            ]);
            expect(text).toMatchInlineSnapshot(`
              LlamaText([
                "Hi there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
              ])
            `);
        });

        test("empty text", async () => {
            const text = LlamaText([
                ""
            ]);
            expect(text.values.length).to.eql(0);
            expect(text).toMatchInlineSnapshot("LlamaText([])");
            expect(text.toJSON()).toMatchInlineSnapshot('""');
            expect(LlamaText.fromJSON("")).toMatchInlineSnapshot("LlamaText([])");
            expect(LlamaText.fromJSON([""])).toMatchInlineSnapshot("LlamaText([])");
        });

        test("sub texts flattening", async () => {
            const text1 = LlamaText([
                "Hi ",
                LlamaText([
                    "Hello ",
                    "there!",
                    new SpecialTokensText("Special"),
                    new SpecialTokensText(" text"),
                    new SpecialToken("EOS")
                ]),
                "there!"
            ]);
            expect(text1).toMatchInlineSnapshot(`
              LlamaText([
                "Hi Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                "there!",
              ])
            `);

            const text2 = LlamaText([
                "Hi ",
                LlamaText([
                    "Hello ",
                    "there!",
                    new SpecialTokensText("Special"),
                    new SpecialTokensText(" text")
                ]),
                new SpecialTokensText(" text2"),
                "there!"
            ]);
            expect(text2).toMatchInlineSnapshot(`
              LlamaText([
                "Hi Hello there!",
                new SpecialTokensText("Special text text2"),
                "there!",
              ])
            `);

            const text3 = LlamaText([
                "Hi ",
                LlamaText([
                    "Hello ",
                    new SpecialTokensText("Special"),
                    new SpecialTokensText(" text"),
                    "there! "
                ]),
                "there!"
            ]);
            expect(text3).toMatchInlineSnapshot(`
              LlamaText([
                "Hi Hello ",
                new SpecialTokensText("Special text"),
                "there! there!",
              ])
            `);

            const text4 = LlamaText([
                "Hi ",
                "",
                LlamaText([
                    "Hello ",
                    new SpecialTokensText("Special"),
                    "",
                    new SpecialTokensText(" text"),
                    "there! "
                ]),
                "there!"
            ]);
            expect(text4).toMatchInlineSnapshot(`
              LlamaText([
                "Hi Hello ",
                new SpecialTokensText("Special text"),
                "there! there!",
              ])
            `);

            const text5 = LlamaText([
                "",
                LlamaText([
                    "Hello ",
                    new SpecialTokensText("Special"),
                    "",
                    new SpecialTokensText(" text"),
                    "there! "
                ]),
                "there!"
            ]);
            expect(text5).toMatchInlineSnapshot(`
              LlamaText([
                "Hello ",
                new SpecialTokensText("Special text"),
                "there! there!",
              ])
            `);

            const text6 = LlamaText([
                "",
                LlamaText([
                    new SpecialTokensText("Special"),
                    "",
                    new SpecialTokensText(" text"),
                    "there! "
                ]),
                "there!"
            ]);
            expect(text6).toMatchInlineSnapshot(`
              LlamaText([
                new SpecialTokensText("Special text"),
                "there! there!",
              ])
            `);
        });

        test("toString", async () => {
            const text1 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);
            expect(text1.toString()).toMatchInlineSnapshot('"Hello there!Special textEOS Hi"');
            expect(text1 + "").toMatchInlineSnapshot('"Hello there!Special textEOS Hi"');
        });

        test("toJSON", async () => {
            const text1 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);
            expect(text1.toJSON()).toMatchInlineSnapshot(`
              [
                "Hello there!",
                {
                  "type": "specialTokensText",
                  "value": "Special text",
                },
                {
                  "type": "specialToken",
                  "value": "EOS",
                },
                " Hi",
              ]
            `);
        });

        test("compare", async () => {
            const text1 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);
            const text2 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);

            const text3 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("BOS"),
                " Hi"
            ]);
            const text4 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special1 text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);
            const text5 = LlamaText([
                "Hello 1there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);
            const text6 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " H"
            ]);
            expect(text1.compare(text2)).to.eql(true);
            expect(text1.compare(LlamaText(text1))).to.eql(true);

            expect(text1.compare(text3)).to.eql(false);
            expect(text1.compare(text4)).to.eql(false);

            expect(text1.compare(text5)).to.eql(false);
            expect(text1.compare(text6)).to.eql(false);
        });

        test("concat", async () => {
            const text1 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);
            const text2 = LlamaText([
                "Hello1 there!",
                new SpecialTokensText("Special1 text"),
                new SpecialToken("BOS"),
                " Hi1"
            ]);

            const text3 = text1.concat(text2);
            expect(text3).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " HiHello1 there!",
                new SpecialTokensText("Special1 text"),
                new SpecialToken("BOS"),
                " Hi1",
              ])
            `);
        });

        test("mapValues", async () => {
            const text1 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);

            const text2 = text1.mapValues((value) => {
                if (typeof value === "string") {
                    return value + "6";
                }
                return value;
            });
            expect(text2).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!6",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi6",
              ])
            `);
        });

        test("joinValues", async () => {
            const text1 = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);

            expect(text1.joinValues("||")).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!||",
                new SpecialTokensText("Special text"),
                "||",
                new SpecialToken("EOS"),
                "|| Hi",
              ])
            `);

            expect(text1.joinValues(new SpecialTokensText("||"))).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("||Special text||"),
                new SpecialToken("EOS"),
                new SpecialTokensText("||"),
                " Hi",
              ])
            `);

            expect(text1.joinValues(new SpecialToken("BOS"))).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialToken("BOS"),
                new SpecialTokensText("Special text"),
                new SpecialToken("BOS"),
                new SpecialToken("EOS"),
                new SpecialToken("BOS"),
                " Hi",
              ])
            `);
        });

        test("trimStart", async () => {
            expect(
                LlamaText([
                    "   Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi"
                ]).trimStart()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "\nHello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi"
                ]).trimStart()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    " ",
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi"
                ]).trimStart()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    " ",
                    " Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi"
                ]).trimStart()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "\n",
                    " Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi"
                ]).trimStart()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    " ",
                    "\nHello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi"
                ]).trimStart()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    new SpecialTokensText(" "),
                    " ",
                    "\nHello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi"
                ]).trimStart()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);
        });

        test("trimEnd", async () => {
            expect(
                LlamaText([
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi   "
                ]).trimEnd()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi\n"
                ]).trimEnd()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi",
                    " "
                ]).trimEnd()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi ",
                    " "
                ]).trimEnd()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi ",
                    "\n"
                ]).trimEnd()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi\n",
                    " "
                ]).trimEnd()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);

            expect(
                LlamaText([
                    "Hello there!",
                    new SpecialTokensText("Special text"),
                    new SpecialToken("EOS"),
                    " Hi\n",
                    " ",
                    new SpecialTokensText(" ")
                ]).trimEnd()
            ).toMatchInlineSnapshot(`
              LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi",
              ])
            `);
        });

        test("includes", async () => {
            const text = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);

            expect(
                text.includes(
                    LlamaText([
                        "Hello there!"
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("Special text")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialToken("EOS")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        "Hello"
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        "there!"
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        "ello t"
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        "there!",
                        new SpecialTokensText("Special text")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        "there!",
                        new SpecialTokensText("Special")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("Special")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("text")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("al te")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("Special text"),
                        new SpecialToken("EOS")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("text"),
                        new SpecialToken("EOS")
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("text"),
                        new SpecialToken("EOS"),
                        " Hi"
                    ])
                )
            ).to.eql(true);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialToken("EOS"),
                        " Hi"
                    ])
                )
            ).to.eql(true);


            expect(
                text.includes(
                    LlamaText([
                        "Some text"
                    ])
                )
            ).to.eql(false);

            expect(
                text.includes(
                    LlamaText([
                        "Special text"
                    ])
                )
            ).to.eql(false);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("Hello there!")
                    ])
                )
            ).to.eql(false);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialTokensText("something")
                    ])
                )
            ).to.eql(false);

            expect(
                text.includes(
                    LlamaText([
                        new SpecialToken("BOS")
                    ])
                )
            ).to.eql(false);
        });

        test("LlamaText.fromJSON", async () => {
            const text = LlamaText([
                "Hello there!",
                new SpecialTokensText("Special text"),
                new SpecialToken("EOS"),
                " Hi"
            ]);

            expect(text.compare(LlamaText.fromJSON(text.toJSON()))).to.eql(true);
        });
    });
});

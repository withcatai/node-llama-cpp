import {beforeAll, describe, expect, test} from "vitest";
import {Template} from "@huggingface/jinja";
import {getTestLlama} from "../../utils/getTestLlama.js";
import type {BindingModule} from "../../../src/bindings/AddonTypes.js";


describe("AddonJinjaRenderer", () => {
    let NativeRenderer: BindingModule["AddonJinjaRenderer"];

    beforeAll(async () => {
        const llama = await getTestLlama();
        NativeRenderer = llama._bindings.AddonJinjaRenderer;
    });

    test.each([
        ["{{ name }}", {name: "Hello 👋\0!"}],
        ["{{ data | tojson }}", {data: {z: 1, a: [true, null, 1.5, "text"]}}],
        ["{{ (value is defined) | tojson }}|{{ (missing is defined) | tojson }}|{{ (value is none) | tojson }}", {value: null}],
        ["{% for message in messages %}{{ message.role }}: {{ message.content }}\n{% endfor %}", {
            messages: [{role: "user", content: "Hello"}, {role: "assistant", content: "Hi"}]
        }],
        ["{% macro greet(name) %}Hello {{ name }}{% endmacro %}{{ greet(name) }}", {name: "Alice"}],
        ["{{ number }}|{{ fraction }}|{{ negative }}", {number: Number.MAX_SAFE_INTEGER, fraction: 1.25, negative: -123}],
        ["{{ (optional is defined) | tojson }}|{{ (sparse[0] is defined) | tojson }}", {optional: undefined, sparse: new Array(1)}]
    ] as const)("renders %s", (template, variables) => {
        const renderer = new NativeRenderer(template);
        expect(renderer.render(variables)).toBe(new Template(template).render(variables));
        expect(renderer.render(variables)).toBe(new Template(template).render(variables));
    });

    test("accepts empty templates and omitted variables", () => {
        expect(new NativeRenderer("").render()).toBe("");
        expect(new NativeRenderer("hello").render(undefined)).toBe("hello");
    });

    test("keeps variables and mutations local to each render", () => {
        const renderer = new NativeRenderer("{{ previous is defined }}{% set previous = value %}{{ previous }}");
        expect(renderer.render({value: "first"})).toBe("Falsefirst");
        expect(renderer.render({value: "second"})).toBe("Falsesecond");
        const input = {values: ["a"]};
        const mutating = new NativeRenderer("{% set ignored = values.append('b') %}{{ values | join(',') }}");
        expect(mutating.render(input)).toBe("a,b");
        expect(mutating.render(input)).toBe("a,b");
        expect(input.values).toEqual(["a"]);
    });

    test("uses only own enumerable string properties and preserves their order", () => {
        const data = Object.assign(Object.create({inherited: "ignored"}), {z: 1, a: 2});
        Object.defineProperty(data, "hidden", {get() {
            throw new Error("must not read hidden");
        }});
        Object.defineProperty(data, Symbol("ignored"), {enumerable: true, get() {
            throw new Error("must not read symbol");
        }});
        expect(new NativeRenderer("{{ data | tojson }}").render({data})).toBe('{"z": 1, "a": 2}');
        expect(new NativeRenderer("{{ data | tojson }}").render({data: Object.assign(Object.create(null), {a: 1})}))
            .toBe('{"a": 1}');
    });

    test("allows repeated references without treating them as cycles", () => {
        const shared = {text: "same"};
        expect(new NativeRenderer("{{ a.text }} {{ b.text }}").render({a: shared, b: shared})).toBe("same same");
    });

    test.each([NaN, Infinity, -Infinity, 1e100, 1n, Symbol("unsupported"), () => "value"])(
        "rejects unsupported values safely: %s", (value) => {
            expect(() => new NativeRenderer("ok").render({nested: {value}})).toThrow(/failed to convert input at items\["nested"\]\["value"\]/);
        }
    );

    test("preserves getter and proxy errors as causes", () => {
        const renderer = new NativeRenderer("{{ value }}");
        const cause = new Error("getter failed");
        const inputs = [
            {get value() {
                throw cause;
            }},
            new Proxy({}, {ownKeys() {
                throw cause;
            }})
        ];
        for (const input of inputs) {
            try {
                renderer.render(input);
                expect.fail("Expected conversion to fail");
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).cause).toBe(cause);
                expect(String(error)).toContain("getter failed");
            }
        }
        expect(renderer.render({value: "recovered"})).toBe("recovered");
    });

    test("reports nested array paths without reading a throwing getter again", () => {
        const renderer = new NativeRenderer("{{ messages[0].content }}");
        const cause = new Error("content getter failed");
        let reads = 0;
        const messages = [{content: "valid"}, {get content() {
            reads++;
            throw cause;
        }}];

        try {
            renderer.render({messages});
            expect.fail("Expected conversion to fail");
        } catch (error) {
            expect((error as Error).cause).toBe(cause);
            expect(String(error)).toContain('failed to convert input at items["messages"][1]["content"]');
        }
        expect(reads).toBe(1);
        expect(renderer.render({messages: [{content: "recovered"}]})).toBe("recovered");
    });

    test("allows nested rendering from an input getter with independent variables", () => {
        const renderer = new NativeRenderer("{{ prefix }}{{ value }}");
        expect(renderer.render({prefix: "outer:", get value() {
            return renderer.render({prefix: "inner:", value: "nested"});
        }})).toBe("outer:inner:nested");
        expect(renderer.render({prefix: "next:", value: "value"})).toBe("next:value");
    });

    test("can render after a nested render fails", () => {
        const renderer = new NativeRenderer("{% filter indent(width) %}a\nb{% endfilter %}");
        expect(renderer.render({get width() {
            expect(() => renderer.render({width: -1})).toThrow(/failed to render template/);
            return 2;
        }})).toBe("a\n  b");
        expect(renderer.render({width: 4})).toBe("a\n    b");
    });

    test("reports compile errors", () => {
        expect(() => new NativeRenderer("{% if %}")).toThrow(/AddonJinjaRenderer: failed to compile template/);
        expect(() => new NativeRenderer("{{ 'unterminated")).toThrow(/lexer/);
    });

    test("reports runtime errors with source locations", () => {
        const renderer = new NativeRenderer("hello\n{{ raise_exception('bad role') }}");
        expect(() => renderer.render()).toThrow(/failed to render template[\s\S]*line 2[\s\S]*bad role/);
    });

    test("can reuse a filter block after it throws", () => {
        const renderer = new NativeRenderer("{% filter indent(width) %}a\nb{% endfilter %}");
        expect(() => renderer.render({width: -1})).toThrow(/failed to render template/);
        expect(renderer.render({width: 2})).toBe("a\n  b");
        expect(renderer.render({width: 4})).toBe("a\n    b");
    });

    test("renders recursive macros using the upstream runtime", () => {
        const renderer = new NativeRenderer("{% macro recurse(n) %}{% if n > 0 %}{{ recurse(n - 1) }}{% else %}ok{% endif %}{% endmacro %}{{ recurse(n) }}");
        expect(renderer.render({n: 80})).toBe("ok");
    });

    test("can render the same and another template after a macro throws on the same thread", () => {
        const renderer = new NativeRenderer("{% macro recurse(n) %}{% if n > 0 %}{{ recurse(n - 1) }}{% elif fail %}{{ raise_exception('macro failed') }}{% else %}ok{% endif %}{% endmacro %}{{ recurse(n) }}");
        const other = new NativeRenderer("{% macro another(n) %}{% if n > 0 %}{{ another(n - 1) }}{% else %}other{% endif %}{% endmacro %}{{ another(n) }}");

        for (let i = 0; i < 3; i++) {
            expect(() => renderer.render({n: 8, fail: true})).toThrow(/macro failed/);
            expect(other.render({n: 8})).toBe("other");
            expect(renderer.render({n: 8, fail: false})).toBe("ok");
        }
    });
});

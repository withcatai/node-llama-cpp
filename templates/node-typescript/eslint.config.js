// @ts-check

import importPlugin from "eslint-plugin-import";
import jsdoc from "eslint-plugin-jsdoc";
import n from "eslint-plugin-n";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";


export default tseslint.config({
    ignores: ["dist/", "models/"]
}, {
    files: ["**/**.{,c,m}{js,ts}"],
    extends: [
        stylistic.configs["recommended-flat"],
        jsdoc.configs["flat/recommended"],
        importPlugin.flatConfigs.recommended
    ],
    plugins: {
        n
    },
    languageOptions: {
        globals: {
            Atomics: "readonly",
            SharedArrayBuffer: "readonly"
        },

        ecmaVersion: 2023,
        sourceType: "module"
    },
    settings: {
        "import/resolver": {
            typescript: true,
            node: true
        },
        jsdoc: {
            exemptDestructuredRootsFromChecks: true,

            tagNamePreference: {
                hidden: "hidden"
            }
        }
    },
    rules: {
        "@stylistic/indent": ["off"],
        "indent": ["warn", 4, {
            SwitchCase: 1,
            FunctionDeclaration: {
                parameters: "first"
            },
            ignoredNodes: [
                // fix for indent warnings on function object return types when the function has no parameters
                'FunctionExpression[params.length=0][returnType.type="TSTypeAnnotation"]'
            ]
        }],
        "@stylistic/indent-binary-ops": ["off"],
        "@stylistic/eqeqeq": ["off"],
        "@stylistic/no-undef": "off",
        "@stylistic/quotes": ["warn", "double", {avoidEscape: true}],
        "no-unused-vars": ["warn", {
            args: "none",
            ignoreRestSiblings: true,
            varsIgnorePattern: "^set",
            caughtErrors: "none"
        }],
        "@stylistic/no-prototype-builtins": ["off"],
        "@stylistic/object-curly-spacing": ["warn", "never"],
        "@stylistic/semi": ["warn", "always"],
        "@stylistic/no-undefined": ["off"],
        "@stylistic/array-bracket-newline": ["error", "consistent"],
        "@stylistic/brace-style": ["error", "1tbs", {
            allowSingleLine: false
        }],
        "@stylistic/comma-spacing": ["error", {
            before: false,
            after: true
        }],
        "@stylistic/comma-style": ["error", "last"],
        "@stylistic/comma-dangle": ["warn", "never"],
        "no-var": ["error"],
        "import/order": ["error", {
            groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type", "object", "unknown"],
            warnOnUnassignedImports: true
        }],
        "n/file-extension-in-import": ["error", "always"],
        "newline-per-chained-call": ["error", {
            ignoreChainWithDepth: 2
        }],
        "no-confusing-arrow": ["error"],
        "no-const-assign": ["error"],
        "no-duplicate-imports": ["error", {
            includeExports: true
        }],
        camelcase: ["warn"],
        "@stylistic/jsx-quotes": ["warn"],
        yoda: ["error", "never", {
            exceptRange: true
        }],
        "no-eval": ["error"],
        "array-callback-return": ["error"],
        "no-empty": ["error", {
            allowEmptyCatch: true
        }],
        "@stylistic/keyword-spacing": ["warn"],
        "@stylistic/space-infix-ops": ["warn"],
        "@stylistic/spaced-comment": ["warn", "always", {
            markers: ["/"]
        }],
        "@stylistic/eol-last": ["warn", "always"],
        "@stylistic/max-len": ["warn", {
            code: 140,
            tabWidth: 4,
            ignoreStrings: true
        }],
        "@stylistic/quote-props": ["off"],
        "@stylistic/arrow-parens": ["warn", "always"],
        "@stylistic/no-multiple-empty-lines": ["off"],
        "@stylistic/operator-linebreak": ["off"],
        "@stylistic/block-spacing": ["warn", "never"],
        "@stylistic/no-extra-parens": ["off"],
        "@stylistic/padded-blocks": ["warn"],
        "@stylistic/multiline-ternary": ["off"],
        "@stylistic/lines-between-class-members": ["warn", {
            enforce: [
                {blankLine: "always", prev: "method", next: "*"},
                {blankLine: "always", prev: "*", next: "method"}
            ]
        }],
        "@stylistic/no-trailing-spaces": ["off"],
        "@stylistic/no-multi-spaces": ["warn"],
        "@stylistic/generator-star-spacing": ["off"]
    }
}, {
    files: ["**/**.{,c,m}ts"],
    extends: [
        jsdoc.configs["flat/recommended-typescript"],
        ...tseslint.configs.recommended
    ],
    settings: {
        "import/resolver": {
            typescript: true,
            node: true
        }
    },
    rules: {
        "no-constant-condition": ["warn"],
        "import/named": ["off"],
        "@typescript-eslint/explicit-module-boundary-types": ["off"],
        "@typescript-eslint/ban-ts-comment": ["off"],
        "@typescript-eslint/no-explicit-any": ["off"],
        "@typescript-eslint/no-inferrable-types": ["off"],
        "@typescript-eslint/no-unused-vars": ["warn", {
            args: "none",
            ignoreRestSiblings: true,
            varsIgnorePattern: "^set",
            caughtErrors: "none"
        }],
        "@typescript-eslint/no-empty-object-type": ["off"],
        "@typescript-eslint/member-ordering": ["warn", {
            default: ["field", "constructor", "method", "signature"],
            typeLiterals: []
        }],
        "@typescript-eslint/parameter-properties": ["warn", {
            allow: []
        }],
        "@typescript-eslint/explicit-member-accessibility": ["warn"],
        "@stylistic/member-delimiter-style": ["warn", {
            multiline: {
                delimiter: "comma",
                requireLast: false
            },
            singleline: {
                delimiter: "comma",
                requireLast: false
            },
            multilineDetection: "brackets"
        }],

        "jsdoc/require-param": ["off"],
        "jsdoc/check-param-names": ["warn", {
            checkDestructured: false
        }],
        "jsdoc/require-returns": ["off"],
        "jsdoc/require-jsdoc": ["off"],
        "jsdoc/require-yields": ["off"],
        "jsdoc/require-param-description": ["off"]
    }
});

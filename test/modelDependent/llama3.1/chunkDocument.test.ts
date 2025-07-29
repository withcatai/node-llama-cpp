import {describe, expect, test} from "vitest";
import {getModelFile} from "../../utils/modelFiles.js";
import {getTestLlama} from "../../utils/getTestLlama.js";
import {experimentalChunkDocument} from "../../../src/index.js";

// made up example paragraph
const exampleParagraph = [
    "The Luminawing (genus: Luxavis, species: nocturna) is a rare and enigmatic nocturnal creature native to the dense forests of the remote continent of Aethoria.",
    "Characterized by its striking appearance and unique adaptations, this mystical animal has garnered significant attention from scientists and naturalists.",
    "",
    "## Physical Characteristics",
    "The Luminawing's most distinctive feature is its pair of iridescent wings, which reflect the colors of its surroundings through a complex process involving microscopic crystals embedded in the wing membrane.",
    "This remarkable ability allows the creature to blend seamlessly into the night sky, making it nearly invisible to predators and prey alike.",
    "",
    "Its slender body measures approximately 30-40 centimeters in length, covered in soft, glowing fur that shimmers like starlight under ultraviolet light. The Luminawing's large, round eyes are capable of perceiving even the faintest glows, allowing it to navigate through the dark forest with ease.",
    "",
    "## Behavior and Habitat",
    "The Luminawing is a solitary creature, only coming together with others of its kind during the mating season.",
    "It inhabits the dense forests of Aethoria, where it feeds on the nectar of rare, moon-blooming flowers (genus: Lunaria).",
    "These flowers are said to possess magical properties, which are believed to be absorbed by the Luminawing through its diet.",
    "",
    "The creature's haunting melody can be heard echoing through the forest at dusk, a siren call that beckons in the night creatures and fills the air with wonder. This unique vocalization is thought to play a crucial role in the Luminawing's mating rituals and territorial defense.",
    "",
    "## Conservation Status",
    "Due to its elusive nature and limited range, the Luminawing is currently listed as a species of special concern by the Aethorian Conservation Society.",
    "Efforts are being made to protect its habitat and study its behavior, but more research is needed to fully understand this enigmatic creature's place in the ecosystem."
].join("\n");

describe("llama 3.1", () => {
    describe("chunk document", () => {
        test("basic usage", {timeout: 1000 * 60 * 60 * 2}, async () => {
            const modelPath = await getModelFile("Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf");
            const llama = await getTestLlama();

            const model = await llama.loadModel({
                modelPath
            });
            const context = await model.createContext({
                contextSize: 4096
            });
            const contextSequence = context.getSequence();

            const res = await experimentalChunkDocument({
                contextSequence,
                document: exampleParagraph
            });

            expect(res.join("\n---\n")).toMatchInlineSnapshot(`
              "The Luminawing
              ---
               (genus: Luxavis, species: nocturna)
              ---
               is a rare and enigmatic nocturnal creature native to the dense forests of the remote continent of Aethoria.

              ---
              Characterized by its striking appearance and unique adaptations, this mystical animal has garnered significant attention from scientists and naturalists.

              ## Physical Characteristics

              ---
              The Luminawing's most distinctive feature is its pair of iridescent wings, which reflect the colors of its surroundings through a complex process involving microscopic crystals embedded in the wing membrane.
              This remarkable ability allows the creature to blend seamlessly into the night sky, making it nearly invisible to predators and prey alike.

              Its slender body measures approximately 30-40 centimeters in length, covered in soft, glowing fur that shimmers like starlight under ultraviolet light. The Luminawing's large, round eyes are capable of perceiving even the faintest glows, allowing it to navigate through the dark forest with ease.

              ## Behavior and Habitat
              The Luminawing is a solitary creature, only coming together with others of its kind during the mating season.
              It inhabits the dense forests of Aethoria, where it feeds on the nectar of rare, moon-blooming flowers (genus: Lunaria).
              These flowers are said to possess magical properties, which are believed to be absorbed by the Luminawing through its diet.

              The creature's haunting melody can be heard echoing through the forest at dusk, a siren call that beckons in the night creatures and fills the air with wonder. This unique vocalization is thought to play a crucial role in the Luminawing's mating rituals and territorial defense.

              ## Conservation Status

              ---
              Due to its elusive nature and limited range, the Luminawing is currently listed as a species of special concern by the Aethorian Conservation Society.
              Efforts are being made to protect its habitat and study its behavior, but more research is needed to fully understand this enigmatic creature's place in the ecosystem."
            `);
        });
    });
});


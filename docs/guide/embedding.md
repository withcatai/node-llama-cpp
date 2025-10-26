---
outline: [2, 4]
description: Using embeddings with node-llama-cpp
---
# Using Embedding
::: info What is an embedding?
An embedding is a numerical vector representation that captures the semantic meaning of a text.

To embed a text is the process of converting a text into an embedding.

This is useful for many NLP (Natural Language Processing) tasks, such as classification, clustering, and similarity search.

This is often used for searching for similar texts based on their meaning, rather than verbatim text matching.
:::

When you have a lot of data, processing all of it using inference (by feeding it into a model and asking it questions about the data)
is slow and can be expensive.
Using inference for processing provides the most high-quality results, but it's not always necessary.

For example, assuming that we have 10K documents and want to find the most relevant ones to a given query,
using inference for all of those documents can take a long time, and even if done in parallel, it can be expensive (in terms of compute resource usage costs).

Instead, we can embed all the documents once and then search for the most similar ones to the query based on the embeddings.
To do that, we embed all the documents in advance and store the embeddings in a database.
Then, when a query comes in, we embed the query and search for the most similar embeddings in the database, and return the corresponding documents.

Read the [choosing a model tutorial](./choosing-a-model.md) to learn how to choose the right model for your use case.

## Finding Relevant Documents
Let's see an example of how we can embed 10 texts and then search for the most relevant one to a given query:
::: warning NOTE
Always make sure you only compare embeddings created using the exact same model file.

Comparing embeddings created using different models can lead to incorrect results and may even cause errors.
:::
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaEmbedding} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "bge-small-en-v1.5-q8_0.gguf")
});
const context = await model.createEmbeddingContext();

async function embedDocuments(documents: readonly string[]) {
    const embeddings = new Map<string, LlamaEmbedding>();

    await Promise.all(
        documents.map(async (document) => {
            const embedding = await context.getEmbeddingFor(document);
            embeddings.set(document, embedding);

            console.debug(
                `${embeddings.size}/${documents.length} documents embedded`
            );
        })
    );

    return embeddings;
}

function findSimilarDocuments(
    embedding: LlamaEmbedding,
    documentEmbeddings: Map<string, LlamaEmbedding>
) {
    const similarities = new Map<string, number>();
    for (const [otherDocument, otherDocumentEmbedding] of documentEmbeddings)
        similarities.set(
            otherDocument,
            embedding.calculateCosineSimilarity(otherDocumentEmbedding)
        );

    return Array.from(similarities.keys())
        .sort((a, b) => similarities.get(b)! - similarities.get(a)!);
}

const documentEmbeddings = await embedDocuments([
    "The sky is clear and blue today",
    "I love eating pizza with extra cheese",
    "Dogs love to play fetch with their owners",
    "The capital of France is Paris",
    "Drinking water is important for staying hydrated",
    "Mount Everest is the tallest mountain in the world",
    "A warm cup of tea is perfect for a cold winter day",
    "Painting is a form of creative expression",
    "Not all the things that shine are made of gold",
    "Cleaning the house is a good way to keep it tidy"
]);


const query = "What is the tallest mountain on Earth?";
const queryEmbedding = await context.getEmbeddingFor(query);

const similarDocuments = findSimilarDocuments(
    queryEmbedding,
    documentEmbeddings
);
const topSimilarDocument = similarDocuments[0];

console.log("query:", query);
console.log("Document:", topSimilarDocument);
```
> This example will produce this output:
> ```
> query: What is the tallest mountain on Earth?
> Document: Mount Everest is the tallest mountain in the world
> ```
> This example uses [bge-small-en-v1.5](https://huggingface.co/CompendiumLabs/bge-small-en-v1.5-gguf/blob/main/bge-small-en-v1.5-q8_0.gguf)

## Getting Raw Vectors {#raw-vector}
To get the raw embedding vectors, you can use the [`vector`](../api/classes/LlamaEmbedding.md#vector) property of the [`LlamaEmbedding`](../api/classes/LlamaEmbedding.md) object:
```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "my-model.gguf")
});
const context = await model.createEmbeddingContext();


const text = "Hello world";
console.log("Text:", text);

const embedding = await context.getEmbeddingFor(text);
console.log("Embedding vector:", embedding.vector);
```

## Reranking Documents {#reranking}
After you search for the most similar documents using embedding vectors,
you can use inference to rerank (sort) the documents based on their relevance to the given query.

Doing this allows you to combine the best of both worlds: the speed of embedding and the quality of inference.

```typescript
import {fileURLToPath} from "url";
import path from "path";
import {getLlama} from "node-llama-cpp";

const __dirname = path.dirname(
    fileURLToPath(import.meta.url)
);

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "bge-reranker-v2-m3-Q8_0.gguf")
});
const context = await model.createRankingContext();

const documents = [
    "The sky is clear and blue today",
    "I love eating pizza with extra cheese",
    "Dogs love to play fetch with their owners",
    "The capital of France is Paris",
    "Drinking water is important for staying hydrated",
    "Mount Everest is the tallest mountain in the world",
    "A warm cup of tea is perfect for a cold winter day",
    "Painting is a form of creative expression",
    "Not all the things that shine are made of gold",
    "Cleaning the house is a good way to keep it tidy"
];

const query = "Tell me a geographical fact";
const rankedDocuments = await context.rankAndSort(query, documents);

const topDocument = rankedDocuments[0]!;
const secondDocument = rankedDocuments[1]!;

console.log("query:", query);
console.log("Top document:", topDocument.document);
console.log("Second document:", secondDocument.document);
console.log("Ranked documents:", rankedDocuments);
```
> This example will produce this output:
> ```
> query: Tell me a geographical fact
> Top document: Mount Everest is the tallest mountain in the world
> Second document: The capital of France is Paris
> ```
> This example uses [bge-reranker-v2-m3-Q8_0.gguf](https://huggingface.co/gpustack/bge-reranker-v2-m3-GGUF/blob/main/bge-reranker-v2-m3-Q8_0.gguf)

## Using External Databases
When you have a large number of documents you want to use with embedding, it's often more efficient to store them with their embedding in an external database and search for the most similar embeddings there.

You can use `node-llama-cpp` to create an embedding and then store the [embedding vector](#raw-vector) in an external database that supports vector search.

### Vector databases {#databases}
Here is a list of some vector databases you can use:

<script setup lang="ts">
import DataBadge from "../../.vitepress/components/DataBadge/DataBadge.vue";
</script>

#### Embedded databases {#databases-embedded}
* **[LanceDB](https://lancedb.com/)** ([GitHub](https://github.com/lancedb/lancedb) | [npm](https://www.npmjs.com/package/@lancedb/lancedb) | [Quick start](https://www.npmjs.com/package/@lancedb/lancedb#usage)) - Serverless vector database you can embed inside your application. No server required.
  <br/><DataBadge title="Written in" content="Rust"/><DataBadge title="License" content="Apache-2.0"/>

* **Vectra** ([GitHub](https://github.com/Stevenic/vectra) | [npm](https://www.npmjs.com/package/vectra)) - local vector database using local files
  <br/><DataBadge title="Written in" content="TypeScript"/><DataBadge title="License" content="MIT"/>

#### Open Source {#databases-oss}
* **[Qdrant](https://qdrant.tech)** ([GitHub](https://github.com/qdrant/qdrant) | [npm](https://www.npmjs.com/package/@qdrant/js-client-rest) | [Quick start](https://qdrant.tech/documentation/quickstart)) - High-performance, massive-scale vector database
  <br/><DataBadge title="Written in" content="Rust"/><DataBadge title="License" content="Apache-2.0"/>

* **[Milvus](https://milvus.io/)** ([GitHub](https://github.com/milvus-io/milvus) | [npm](https://www.npmjs.com/package/@zilliz/milvus2-sdk-node) | [Quick start](https://github.com/milvus-io/milvus-sdk-node?tab=readme-ov-file#basic-usages)) - A cloud-native vector database
  <br/><DataBadge title="Written in" content="Go, C++"/><DataBadge title="License" content="Apache-2.0"/>

* **[Chroma](https://www.trychroma.com)** ([GitHub](https://github.com/chroma-core/chroma) | [npm](https://www.npmjs.com/package/chromadb) | [Guide](https://docs.trychroma.com/guides))
  <br/><DataBadge title="Written in" content="Python, Rust"/><DataBadge title="License" content="Apache-2.0"/>

* **[Apache Cassandra](https://cassandra.apache.org)** ([GitHub](https://github.com/apache/cassandra) | [npm](https://www.npmjs.com/package/cassandra-driver) | [Quickstart](https://cassandra.apache.org/_/quickstart.html) | [Vector search quickstart](https://cassandra.apache.org/doc/latest/cassandra/getting-started/vector-search-quickstart.html)) - Highly-scalable distributed NoSQL database with vector search support
  <br/><DataBadge title="Written in" content="Java"/><DataBadge title="License" content="Apache-2.0"/>

#### Proprietary {#databases-proprietary}
* **[Redis](https://redis.io/)** via the [Redis Search](https://github.com/RediSearch/RediSearch) module ([Vector Search docs](https://redis.io/docs/latest/develop/interact/search-and-query/query/vector-search/)) - [High-performance](https://redis.io/blog/benchmarking-results-for-vector-databases/) vector search. Useful if you already use Redis Stack or Redis Enterprise.
  <br/><DataBadge title="Written in" content="C"/><DataBadge title="License" content="Custom"/><DataBadge title="Not open source" content="Source available" href="https://redis.io/legal/licenses/"/><DataBadge title="Self hosting price" content="Free" href="https://github.com/redis/redis/blob/7.4.0/LICENSE.txt"/>

* **[ElasticSearch](https://www.elastic.co/elasticsearch)** - [native vector search support](https://www.elastic.co/elasticsearch/vector-database). Useful is you already use ElasticSearch.
  <br/><DataBadge title="Written in" content="Java"/><DataBadge title="License" content="Custom"/><DataBadge title="Partially open source" content="Source available" href="https://www.elastic.co/pricing/faq/licensing"/><DataBadge title="Self hosting price" content="Free" href="https://www.elastic.co/subscriptions"/>

> Does this list miss your favorite vector database? Open a PR to add it!

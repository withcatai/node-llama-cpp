import retry from "async-retry";
import MetadataNotParsedYetError from "./errors/MetadataNotParsedYetError.js";
import GGUFInsights, {GGUFInsightsOptions} from "./GGUFInsights.js";
import {GgufParser, GGUFMetadataResponse} from "./ggufParser/GgufParser.js";
import {GgufFetchStream} from "./ggufParser/stream/GgufFetchStream.js";
import {GgufFsReadStream} from "./ggufParser/stream/GgufFsReadStream.js";

export type GGUFMetadataOptions = {
    source?: "network" | "local",
    retry?: retry.Options,
    ignoreKeys?: string[],
    insights?: GGUFInsightsOptions
};

export default class GGUFMetadata {
    protected _metadata?: GGUFMetadataResponse;
    public readonly path: string;
    public readonly options: Partial<GGUFMetadataOptions> = {};

    public constructor(path: string, options: Partial<GGUFMetadataOptions> = {}) {
        this.options = options;
        this.path = path;
    }

    public get metadata() {
        if (!this._metadata) {
            throw new MetadataNotParsedYetError(this.path);
        }
        return this._metadata;
    }

    public get insights(){
        return new GGUFInsights(this.metadata, this.options.insights);
    }

    public async parse() {
        const stream = this._createStream();
        const parser = new GgufParser({
            stream,
            ignoreKeys: this.options.ignoreKeys
        });
        return this._metadata = await parser.parseMetadata();
    }

    private _createStream() {
        switch (this.options.source) {
            case "network":
                return new GgufFetchStream({
                    url: this.path,
                    retryOptions: this.options.retry
                });
            case "local":
            default:
                return new GgufFsReadStream({
                    filePath: this.path,
                    retryOptions: this.options.retry
                });
        }
    }
}

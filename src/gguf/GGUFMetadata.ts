import retry from "async-retry";
import MetadataNotParsedYetError from "./errors/MetadataNotParsedYetError.js";
import GGUFInsights, {GGUFInsightsOptions} from "./GGUFInsights.js";
import GGUFParser, {GGUFMetadataResponse} from "./ggufParser/GGUFParser.js";
import GGUFFetchStream from "./ggufParser/stream/GGUFFetchStream.js";
import GGUFReadStream from "./ggufParser/stream/GGUFReadStream.js";

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

    public get metadata() {
        if (!this._metadata) {
            throw new MetadataNotParsedYetError(this.path);
        }
        return this._metadata;
    }

    public get insights(){
        return new GGUFInsights(this.metadata, this.options.insights);
    }

    public constructor(path: string, options: Partial<GGUFMetadataOptions> = {}) {
        this.options = options;
        this.path = path;
    }

    public async parse() {
        const stream = this._createStream();
        const parser = new GGUFParser(stream, this.options.ignoreKeys);
        return this._metadata = await parser.parseMetadata();
    }

    private _createStream() {
        switch (this.options.source) {
            case "network":
                return new GGUFFetchStream(this.path, {retry: this.options.retry});
            case "local":
            default:
                return new GGUFReadStream(this.path, {retry: this.options.retry});
        }
    }
}

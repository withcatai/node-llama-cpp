import retry from "async-retry";
import MetadataNotParsedYetError from "./errors/MetadataNotParsedYetError.js";
import GGUFInsights, {GGUFInsightsOptions} from "./GGUFInsights.js";
import {GgufParser, GGUFMetadataResponse} from "./ggufParser/GgufParser.js";
import {GgufFetchFileReader} from "./ggufParser/fileReaders/GgufFetchFileReader.js";
import {GgufFsFileReader} from "./ggufParser/fileReaders/GgufFsFileReader.js";

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
        const fileReader = this._createFileReader();
        const parser = new GgufParser({
            fileReader,
            ignoreKeys: this.options.ignoreKeys
        });
        return this._metadata = await parser.parseMetadata();
    }

    private _createFileReader() {
        switch (this.options.source) {
            case "network":
                return new GgufFetchFileReader({
                    url: this.path,
                    retryOptions: this.options.retry
                });
            case "local":
            default:
                return new GgufFsFileReader({
                    filePath: this.path,
                    retryOptions: this.options.retry
                });
        }
    }
}

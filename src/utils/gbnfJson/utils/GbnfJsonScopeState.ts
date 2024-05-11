export type GbnfJsonScopeSettings = {
    readonly allowNewLines: boolean,
    readonly scopePadSpaces: number
};

export class GbnfJsonScopeState {
    public readonly settings: GbnfJsonScopeSettings;
    public readonly currentNestingScope: number;

    public constructor(settings: GbnfJsonScopeSettings = {
        allowNewLines: true,
        scopePadSpaces: 4
    }, currentNestingScope: number = 0) {
        this.settings = settings;
        this.currentNestingScope = currentNestingScope;
    }

    public getForNewScope(): GbnfJsonScopeState {
        return new GbnfJsonScopeState(this.settings, this.currentNestingScope + 1);
    }
}


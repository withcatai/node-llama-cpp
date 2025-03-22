export class UniqueIdGenerator {
    public readonly antiText: string;
    private readonly _ids = new Set<string>();

    public constructor(antiText: string) {
        this.antiText = antiText;
    }

    public generateId(numbersOnly: boolean = false): string {
        let id: string;

        do {
            if (numbersOnly) {
                do {
                    id = (
                        Math.random()
                            .toString(10)
                            .slice(2)
                            .slice(0, String(Number.MAX_SAFE_INTEGER).length - 1)
                    );
                } while (id.startsWith("0"));
            } else
                id = "W" + (
                    Math.random()
                        .toString(36)
                        .slice(2)
                ) + "W";
        } while (this._ids.has(id) || this.antiText.includes(id));

        this._ids.add(id);

        return id;
    }

    public removeId(id: string) {
        this._ids.delete(id);
    }
}


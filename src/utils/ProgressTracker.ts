export class ProgressTracker {
    /** @internal */ private _tasks: ProgressTaskData[] = [];
    /** @internal */ private readonly _onProgress: (completed: number, estimated: number) => void;

    public constructor(onProgress: (completed: number, estimated: number) => void) {
        this._onProgress = onProgress;
    }

    public createTask(estimated: number = 0) {
        const taskData: ProgressTaskData = {
            completed: 0,
            estimated: estimated
        };
        this._tasks.push(taskData);

        if (estimated !== 0)
            this._pushUpdate();

        return ProgressTrackerTask._create(taskData, this);
    }

    public get status(): {
        completed: number,
        estimated: number
    } {
        return {
            completed: this._tasks.reduce((sum, task) => sum + task.completed, 0),
            estimated: this._tasks.reduce((sum, task) => sum + task.estimated, 0)
        };
    }

    /** @internal */
    public _pushUpdate() {
        const status = this.status;
        if (status.completed === 0)
            return;

        this._onProgress(status.completed, status.estimated);
    }
}

export class ProgressTrackerTask {
    /** @internal */ private readonly _data: ProgressTaskData;
    public readonly tracker: ProgressTracker;

    private constructor(data: ProgressTaskData, tracker: ProgressTracker) {
        this._data = data;
        this.tracker = tracker;
    }

    public update(completed: number, estimated?: number) {
        if (estimated == null) {
            if (completed === this._data.completed)
                return;

            this._data.completed = completed;
            this._data.estimated = Math.max(this._data.estimated, completed);
            this.tracker._pushUpdate();
        } else {
            estimated = Math.max(estimated, completed);
            if (this._data.completed === completed && this._data.estimated === estimated)
                return;
    
            this._data.completed = completed;
            this._data.estimated = estimated;
            this.tracker._pushUpdate();
        }
    }

    public get status(): {
        completed: number,
        estimated: number
    } {
        return {
            completed: this._data.completed,
            estimated: this._data.estimated
        };
    }

    /** @internal */
    public static _create(data: ProgressTaskData, tracker: ProgressTracker): ProgressTrackerTask {
        return new ProgressTrackerTask(data, tracker);
    }
}

type ProgressTaskData = {
    completed: number,
    estimated: number
};

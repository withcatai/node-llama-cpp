import {useSyncExternalStore} from "react";
import {State} from "lifecycle-utils";

export function useExternalState<const StateType, const R>(state: State<StateType>, selector: ((state: StateType) => R)): R;
export function useExternalState<const StateType>(state: State<StateType>): StateType;
export function useExternalState<const StateType>(state: State<StateType>, selector?: ((state: StateType) => any) | null): StateType {
    const currentState = useSyncExternalStore(
        (callback) => state.createChangeListener(callback).dispose,
        () => (selector == null ? state.state : selector(state.state))
    );

    return currentState;
}

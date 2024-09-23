import {useEffect, useState} from "react";
import {State} from "lifecycle-utils";

export function useExternalState<const StateType, const R>(state: State<StateType>, selector: ((state: StateType) => R)): R;
export function useExternalState<const StateType>(state: State<StateType>): StateType;
export function useExternalState<const StateType>(state: State<StateType>, selector?: ((state: StateType) => any) | null): StateType {
    const [currentState, setCurrentState] = useState(() => (
        selector == null
            ? state.state
            : selector(state.state)
    ));

    useEffect(() => {
        return state.createChangeListener((newState) => {
            setCurrentState(
                selector == null
                    ? newState
                    : selector(newState)
            );
        }, true).dispose;
    }, [state]);

    return currentState;
}

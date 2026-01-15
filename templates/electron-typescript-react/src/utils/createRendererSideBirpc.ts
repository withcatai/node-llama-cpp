import {createBirpc} from "birpc";

export function createRendererSideBirpc<
    const ElectronFunction = Record<string, never>,
    const RendererFunctions extends object = Record<string, never>
>(
    toRendererEventName: string,
    fromRendererEventName: string,
    rendererFunctions: RendererFunctions
) {
    return createBirpc<ElectronFunction, RendererFunctions>(rendererFunctions, {
        post: (data) => window.ipcRenderer.send(fromRendererEventName, data),
        on: (onData) => window.ipcRenderer.on(toRendererEventName, (event, data) => {
            onData(data);
        }),
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => JSON.parse(value)
    });
}

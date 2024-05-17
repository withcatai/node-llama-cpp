import {BrowserWindow, ipcMain} from "electron";
import {createBirpc} from "birpc";

export function createElectronSideBirpc<
    const RendererFunction = Record<string, never>,
    const ElectronFunctions extends object = Record<string, never>
>(
    toRendererEventName: string,
    fromRendererEventName: string,
    window: BrowserWindow,
    electronFunctions: ElectronFunctions
) {
    return createBirpc<RendererFunction, ElectronFunctions>(electronFunctions, {
        post: (data) => window.webContents.send(toRendererEventName, data),
        on: (onData) => ipcMain.on(fromRendererEventName, (event, data) => {
            if (BrowserWindow.fromWebContents(event.sender) === window)
                onData(data);
        }),
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => JSON.parse(value)
    });
}

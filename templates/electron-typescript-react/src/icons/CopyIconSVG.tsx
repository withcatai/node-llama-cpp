import {SVGProps} from "react";

export function CopyIconSVG(props: SVGProps<SVGSVGElement>) {
    return <svg height="24px" viewBox="0 -960 960 960" width="24px" {...props}>
        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" />
    </svg>;
}

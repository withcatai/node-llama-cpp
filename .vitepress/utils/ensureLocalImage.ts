import {MultiKeyMap, withLock} from "lifecycle-utils";
import sharp, {FormatEnum} from "sharp";

const resolvedImages = new MultiKeyMap<readonly [url: string, baseDestLocation: string | undefined], {
    urlPath: {
        relative: string,
        absolute: string
    },
    previewUrlPath: {
        relative: string,
        absolute: string
    },
    width?: number,
    height?: number
}>();

export const relativeToAbsoluteImageUrls = new Map<string, string>();
export const resolveImageBuffers = new MultiKeyMap<readonly [url: string, baseDestLocation: string | undefined], {
    mainImage: {
        path: {
            relative: string,
            absolute: string
        },
        buffer: Uint8Array
    },
    previewImage: {
        path: {
            relative: string,
            absolute: string
        },
        buffer: Uint8Array
    }
}>();

export async function ensureLocalImage(url: string, name: string, {
    baseDestLocation = [],
    maxFileSize = 300 * 1024
}: {
    baseDestLocation?: string[],
    maxFileSize?: number
} = {}) {
    if (url.startsWith("/") || process.env.NODE_ENV !== "production")
        return {
            urlPath: {
                relative: url,
                absolute: url
            },
            previewUrlPath: {
                relative: url,
                absolute: url
            }
        };

    const cacheKey = getCacheKey({url, name, baseDestLocation, maxFileSize});
    if (resolvedImages.has(cacheKey))
        return resolvedImages.get(cacheKey)!;

    return await withLock([resolvedImages, ...cacheKey], async () => {
        if (resolvedImages.has(cacheKey))
            return resolvedImages.get(cacheKey)!;

        let fetchRes: Response;
        try {
            fetchRes = await fetchWithRetry(url);
        } catch (err) {
            console.error(`Failed to fetch image: ${url}`, err);
            throw err;
        }

        if (!fetchRes.ok)
            throw new Error(`Failed to fetch image: ${url}. status: ${fetchRes.status}`);

        const fileBuffer = Buffer.from(await fetchRes.arrayBuffer());
        async function getDestFileBuffer(): Promise<[buffer: Buffer, fileExtension: string, width?: number, height?: number]> {
            const resFileMetadata = await sharp(fileBuffer).metadata();

            if (fileBuffer.byteLength > maxFileSize || (resFileMetadata.format !== "jpg" && resFileMetadata.format !== "jpeg")) {
                const resFileBuffer = await compressJpegUnderFileSize(fileBuffer, maxFileSize);
                const resFileMetadata = await sharp(fileBuffer).metadata();

                return [resFileBuffer, "jpg", resFileMetadata.width, resFileMetadata.height];
            }

            const fileExtension = getFileExtension(resFileMetadata.format);
            if (fileExtension == null)
                throw new Error(`Cannot determine file extension for image: ${url}`);

            return [fileBuffer, fileExtension, resFileMetadata.width, resFileMetadata.height];
        }

        const [
            [destFileBuffer, destFileExtension, width, height],
            previewFileBuffer
        ] = await Promise.all([
            getDestFileBuffer(),
            createLowResPreview(fileBuffer)
        ]);

        if (width == null || height == null)
            throw new Error(`Failed to get image dimensions for: ${url}`);

        const mainFileName = `${name}.${destFileExtension}`;
        const previewFileName = `${name}.preview.avif`;

        const res = {
            urlPath: {
                relative: [...baseDestLocation, mainFileName].join("/"),
                absolute: "/" + [...baseDestLocation, mainFileName].join("/")
            },
            previewUrlPath: {
                relative: [...baseDestLocation, previewFileName].join("/"),
                absolute: "/" + [...baseDestLocation, previewFileName].join("/")
            },
            width,
            height
        };

        resolveImageBuffers.set(cacheKey, {
            mainImage: {
                path: res.urlPath,
                buffer: destFileBuffer
            },
            previewImage: {
                path: res.previewUrlPath,
                buffer: previewFileBuffer
            }
        });
        relativeToAbsoluteImageUrls.set(res.urlPath.relative, res.urlPath.absolute);
        relativeToAbsoluteImageUrls.set(res.previewUrlPath.relative, res.previewUrlPath.absolute);

        resolvedImages.set(cacheKey, res);

        return res;
    });
}

async function compressJpegUnderFileSize(
    buffer: Buffer,
    maxFileSize: number,
    minQuality = 6,
    quality = 75,
    drop = 1
) {
    const res = await sharp(buffer)
        .jpeg({
            mozjpeg: true,
            quality
        })
        .toBuffer();

    if (res.byteLength <= maxFileSize || quality <= minQuality)
        return res;

    return await compressJpegUnderFileSize(buffer, maxFileSize, minQuality, Math.max(quality - drop, minQuality), drop);
}

function getCacheKey({url, name, baseDestLocation, maxFileSize}: {
    url: string, name: string, maxFileSize: number, baseDestLocation?: string[]
}) {
    return [url, `${maxFileSize}-${baseDestLocation?.join("/")}-${name}`] as const;
}

async function createLowResPreview(buffer: Buffer) {
    return await sharp(buffer)
        .resize({
            fit: "inside",
            width: 2048,
            height: 1024,
            withoutEnlargement: true
        })
        .avif({
            quality: 1,
            effort: 5
        })
        .toBuffer();
}

function getFileExtension(format: keyof FormatEnum | undefined) {
    if (format === "jpeg")
        return "jpg";

    return format;
}

async function fetchWithRetry(url: string, retires: number = 5, waitTime: number = 1000 * 2) {
    for (let i = retires; i >= 0; i--) {
        try {
            return await fetch(url, {
                redirect: "follow"
            });
        } catch (err) {
            if (i === 0) {
                console.error(`Failed to fetch image: ${url}`, err);
                throw err;
            }

            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
    }

    throw new Error(`Failed to fetch image: ${url}`);
}

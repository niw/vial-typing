declare module "xz-decompress" {
  export class XzReadableStream extends ReadableStream<Uint8Array> {
    constructor(stream: ReadableStream);
  }
}

declare module "lzma/src/lzma_worker.js" {
  export const LZMA_WORKER: {
    compress(
      data: string | number[] | Uint8Array,
      mode: number,
      callback: (result: number[], error: unknown) => void,
    ): void;
    decompress(data: number[] | Uint8Array, callback: (result: string | number[], error: unknown) => void): void;
  };
}

declare module '*hid.mjs' {
  export function createHidCollector(options: {
    onRead(code: string): void;
    isKnown(code: string): boolean;
    onPartial?(value: string): void;
  }): { setValue(value: string): void; key(event: KeyboardEvent): boolean; clear(): void; value: string };
}

declare module '*camera.mjs' {
  export function createReader(options: {
    video: HTMLVideoElement; canvas: HTMLCanvasElement;
    onStatus(message: string, error?: boolean): void;
    onRead(code: string): boolean;
  }): { start(): Promise<void>; stop(): void };
}

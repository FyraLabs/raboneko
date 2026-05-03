declare module '@moonshine-ai/moonshine-js' {
  export const Settings: {
    BASE_ASSET_PATH: {
      MOONSHINE: string;
      ONNX_RUNTIME: string;
      SILERO_VAD: string;
    };
  };

  export class MoonshineModel {
    constructor(modelURL: string, precision?: string);
    loadModel(): Promise<void>;
    generate(audio: Float32Array): Promise<string | undefined>;
  }
}

export interface SystemInfo {
  environment: string;
  ansibleProvider: string;
  releaseProvider: string;
  bedrockProvider: string;
  bedrockModelId: string | null;
  awsRegion: string | null;
}

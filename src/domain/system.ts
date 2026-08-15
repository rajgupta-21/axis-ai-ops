export interface SystemInfo {
  environment: string;
  ansibleProvider: string;
  /** Populated only when ansibleProvider is "ec2". Never includes key material. */
  ansibleHost: string | null;
  ansibleUser: string | null;
  ansiblePort: number | null;
  ansibleInventoryPath: string | null;
  releaseProvider: string;
  embeddingProvider: string;
  embeddingModel: string;
  webSearchEnabled: boolean;
  bedrockProvider: string;
  bedrockModelId: string | null;
  awsRegion: string | null;
}

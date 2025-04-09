export interface UserSettings {
  scaleDistribution?: {
    type: string;
    log?: number;
  };
  [key: string]: unknown;
}

export interface PinnedPoint {
  key: string;
  dataIdxs: Array<number | null>;
  seriesIdx: number | null;
  position: {
    left: number;
    top: number;
  };
}

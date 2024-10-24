import { DataFrame, Field, GrafanaTheme2, TimeRange, TimeZone } from '@grafana/data';
import { VizOrientation } from '@grafana/schema';
import { UPlotConfigBuilder } from '@grafana/ui';

import { AxisProps } from './UPlotAxisBuilder';
import { ScaleProps } from './UPlotScaleBuilder';

export type Renderers = Array<{
  fieldMap: Record<string, string>;
  indicesOnly: string[];
  init: (config: UPlotConfigBuilder, fieldIndices: Record<string, number>) => void;
}>;

/** @alpha */
type UPlotConfigPrepOpts<T extends Record<string, unknown> = {}> = {
  frame: DataFrame;
  theme: GrafanaTheme2;
  timeZones: TimeZone[];
  getTimeRange: () => TimeRange;
  allFrames: DataFrame[];
  renderers?: Renderers;
  tweakScale?: (opts: ScaleProps, forField: Field) => ScaleProps;
  tweakAxis?: (opts: AxisProps, forField: Field) => AxisProps;
  hoverProximity?: number;
  orientation?: VizOrientation;
} & T;

/** @alpha */
export type UPlotConfigPrepFn<T extends {} = {}> = (opts: UPlotConfigPrepOpts<T>) => UPlotConfigBuilder;

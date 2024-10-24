import { UPlotConfigBuilder } from '@grafana/ui';
import { DataFrame } from '@grafana/data';

/**
 * mostly duplicates logic in PlotLegend below :(
 *
 * @internal
 */
export function hasVisibleLegendSeries(config: UPlotConfigBuilder, data: DataFrame[]) {
  return config.getSeries().some((s) => {
    const fieldIndex = s.props.dataFrameFieldIndex;

    if (!fieldIndex) {
      return false;
    }

    const field = data[fieldIndex.frameIndex]?.fields[fieldIndex.fieldIndex];

    if (!field || field.config.custom?.hideFrom?.legend) {
      return false;
    }

    return true;
  });
}

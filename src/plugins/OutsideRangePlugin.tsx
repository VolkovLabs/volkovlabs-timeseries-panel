import React, { useLayoutEffect, useRef, useState } from 'react';
import uPlot, { Scale, TypedArray } from 'uplot';

import { AbsoluteTimeRange } from '@grafana/data';
import { Button, UPlotConfigBuilder } from '@grafana/ui';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
}

/**
 * OutsideRangePlugin
 * Handle outside values range
 */
export const OutsideRangePlugin = ({ config, onChangeTimeRange }: ThresholdControlsPluginProps) => {
  const plotInstance = useRef<uPlot>();
  const [timevalues, setTimeValues] = useState<number[] | TypedArray>([]);
  const [timeRange, setTimeRange] = useState<Scale | undefined>();

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      plotInstance.current = u;
    });

    config.addHook('setScale', (u) => {
      setTimeValues(u.data?.[0] ?? []);
      setTimeRange(u.scales['x'] ?? undefined);
    });
  }, [config]);

  if (timevalues.length < 2 || !onChangeTimeRange) {
    return null;
  }

  if (!timeRange || !timeRange.time || !timeRange.min || !timeRange.max!) {
    return null;
  }

  // Time values are always sorted for uPlot to work
  let i = 0,
    j = timevalues.length - 1;

  while (i <= j && timevalues[i] == null) {
    i++;
  }

  while (j >= 0 && timevalues[j] == null) {
    j--;
  }

  const first = timevalues[i];
  const last = timevalues[j];
  const fromX = timeRange.min;
  const toX = timeRange.max;

  if (first == null || last == null) {
    return null;
  }

  // (StartA <= EndB) and (EndA >= StartB)
  if (first <= toX && last >= fromX) {
    return null;
  }

  return (
    <div>
      <div>Data outside time range</div>
      <Button
        onClick={() => onChangeTimeRange({ from: first, to: last })}
        variant="secondary"
        data-testid="time-series-zoom-to-data"
      >
        Zoom to data
      </Button>
    </div>
  );
};

OutsideRangePlugin.displayName = 'OutsideRangePlugin';

import React from 'react';

import { AbsoluteTimeRange, DataFrame } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';
import { OutsideRangePlugin } from './OutsideRangePlugin';
import { OutsideScalePlugin } from './OutsideScalePlugin';

interface ThresholdControlsPluginProps {
  config: UPlotConfigBuilder;
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void;
  frames: DataFrame[] | null;
  customScalesHandler: () => void;
}

/**
 * OutsideConfigPlugins
 * Handle all 'Outside' plugins
 */
export const OutsideConfigPlugins = ({
  config,
  onChangeTimeRange,
  frames,
  customScalesHandler,
}: ThresholdControlsPluginProps) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-evenly',
      }}
    >
      <OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />
      <OutsideScalePlugin frames={frames} onClick={customScalesHandler} />
    </div>
  );
};

OutsideConfigPlugins.displayName = 'OutsideConfigPlugins';

import React, { useMemo } from 'react';

import { DataFrame, FieldType } from '@grafana/data';
import { Button } from '@grafana/ui';
import { checkScaleLimits } from '../utils';

interface ThresholdControlsPluginProps {
  onClick: () => void;
  frames: DataFrame[] | null;
}

/**
 * OutsideScalePlugin
 * Handle outside values off scales
 */
export const OutsideScalePlugin = ({ frames, onClick }: ThresholdControlsPluginProps) => {
  const isValuesOutsideOfScales = useMemo(() => {
    if (!frames) {
      return false;
    }

    const currentFields = frames.flatMap((frame) => frame.fields).filter((field) => field.type !== FieldType.time);
    const fieldsWithScaleConfigs = currentFields?.filter((field) => !!field.config.max || !!field.config.min);

    if (!fieldsWithScaleConfigs?.length || fieldsWithScaleConfigs?.length !== currentFields.length) {
      return false;
    }

    return fieldsWithScaleConfigs.every((field) => {
      const minConfig = field.config.min;
      const maxConfig = field.config.max;
      return checkScaleLimits(field.values, minConfig, maxConfig);
    });
  }, [frames]);

  if (!isValuesOutsideOfScales) {
    return null;
  }

  return (
    <div>
      <div>Data outside scale range</div>
      <Button onClick={onClick} variant="secondary" data-testid="time-series-zoom-to-data">
        Set custom scales
      </Button>
    </div>
  );
};

OutsideScalePlugin.displayName = 'OutsideScalePlugin';

import React, { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { Select } from '@grafana/ui';

type Props = StandardEditorProps<SelectableValue<{ mode: GraphThresholdsStyleMode }>, any>;

export const ThresholdsStyleEditor = ({ item, value, onChange, id }: Props) => {
  const onChangeCb = useCallback(
    (v: SelectableValue<GraphThresholdsStyleMode>) => {
      onChange({
        mode: v.value,
      });
    },
    [onChange]
  );
  return <Select inputId={id} value={value.mode} options={item.settings.options} onChange={onChangeCb} />;
};

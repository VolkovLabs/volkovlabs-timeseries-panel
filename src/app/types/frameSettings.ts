import { AxisPlacement } from '@grafana/ui';

export interface FieldSettings {
  refId?: string;
  name: string;
  axisPlacement: AxisPlacement;
  hideFrom: {
    viz: boolean;
  };
}

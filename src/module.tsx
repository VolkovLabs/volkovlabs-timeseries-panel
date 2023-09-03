import { PanelPlugin } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { commonOptionsBuilder } from '@grafana/ui';
import { defaultGraphConfig, getGraphFieldConfig } from './config';
import { FieldConfig, Options } from './panelcfg.gen';
import { TimeSeriesSuggestionsSupplier } from './suggestions';
import { TimeSeriesPanel } from './TimeSeriesPanel';
import { TimezonesEditor } from './TimezonesEditor';

export const plugin = new PanelPlugin<Options, FieldConfig>(TimeSeriesPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);

    builder.addCustomEditor({
      id: 'timezone',
      name: 'Time zone',
      path: 'timezone',
      category: ['Axis'],
      editor: TimezonesEditor,
      defaultValue: undefined,
    });

    /**
     * Variables
     */
    const variables = getTemplateSrv().getVariables();
    const variableOptions = variables.map((vr) => ({
      label: vr.name,
      value: vr.name,
    }));

    builder.addSelect({
      path: 'variable',
      name: 'Select variable for Annotations',
      settings: {
        options: variableOptions,
      },
      category: ['Annotations'],
    });
  })
  .setSuggestionsSupplier(new TimeSeriesSuggestionsSupplier())
  .setDataSupport({ annotations: true, alertStates: true });

import { config } from 'app/core/config';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import React, { useCallback, useMemo, useState } from 'react';
import { CartesianCoords2D, DataFrame, DataFrameType, Field, PanelProps, toDataFrame } from '@grafana/data';
import { getBackendSrv, PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { KeyboardPlugin, MenuItemProps, TimeSeries, TooltipPlugin, usePanelContext, ZoomPlugin } from '@grafana/ui';
import { Options } from './panelcfg.gen';
import { AnnotationEditorPlugin } from './plugins/AnnotationEditorPlugin';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { TimescaleEditor } from './plugins/timescales/TimescaleEditor';
import { TimescaleEditFormDTO } from './plugins/timescales/TimescaleEditorForm';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getTimezones, prepareGraphableFields, regenerateLinksSupplier } from './utils';

interface TimeSeriesPanelProps extends PanelProps<Options> {}

export const TimeSeriesPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
  id,
}: TimeSeriesPanelProps) => {
  const { sync, canAddAnnotations, onThresholdsChange, canEditThresholds, showThresholds, onSplitOpen } =
    usePanelContext();

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
  };

  const [isAddingTimescale, setAddingTimescale] = useState(false);
  const [timescaleTriggerCoords, setTimescaleTriggerCoords] = useState<{
    viewport: CartesianCoords2D;
    plotCanvas: CartesianCoords2D;
  } | null>(null);

  const frames = useMemo(() => prepareGraphableFields(data.series, config.theme2, timeRange), [data.series, timeRange]);
  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);

  const [timescalesFrame, setTimescalesFrame] = useState<DataFrame | null>(null);

  const mappings = fieldConfig.defaults.mappings;
  let scales: string[] = [];

  if (mappings && mappings.length) {
    mappings
      .map((mapping: any) => mapping.options)
      .map((mapping: any) => {
        Object.keys(mapping).forEach((key: string) => {
          if (key.toLowerCase().match(/scale/)) {
            scales.push(mapping[key].text);
          }
        });
      });
  }

  const getTimescales = useCallback(async () => {
    const user = config.bootData.user;
    const userId = user?.id;
    const rawSql = `select last(min, time) as min, last(max, time) as max, metric from scales where user_id='${userId}' group by metric;`;
    const target = data.request?.targets[0];
    const datasourceId = target?.datasource?.uid;
    const refId = target?.refId;

    if (refId) {
      const response = await getBackendSrv().post('/api/ds/query', {
        debug: true,
        from: 'now-1h',
        publicDashboardAccessToken: 'string',
        queries: [
          {
            datasource: {
              uid: datasourceId,
            },
            format: 'table',
            intervalMs: 86400000,
            maxDataPoints: 1092,
            rawSql,
            refId,
          },
        ],
        to: 'now',
      });

      setTimescalesFrame(toDataFrame(response.results?.[refId]?.frames[0]));
      return;
    }

    setTimescalesFrame(null);
  }, [data.request?.targets]);

  const onAddTimescale = useCallback(
    async (formData: TimescaleEditFormDTO) => {
      const { min, max, description, scale } = formData;
      const user = config.bootData.user;
      const userId = user?.id;
      const sanitizedDescription = description.replace(/\"|\'/g, '');
      const rawSql = `insert into scales values(now(), ${min}, ${max}, '${sanitizedDescription}', ${userId}, '${scale}')`;
      const target = data.request?.targets[0];
      const datasourceId = target?.datasource?.uid;
      const refId = target?.refId;

      await getBackendSrv().post('/api/ds/query', {
        debug: true,
        from: 'now-1h',
        publicDashboardAccessToken: 'string',
        queries: [
          {
            datasource: {
              uid: datasourceId,
            },
            format: 'table',
            intervalMs: 86400000,
            maxDataPoints: 1092,
            rawSql,
            refId,
          },
        ],
        to: 'now',
      });
      setAddingTimescale(false);
    },
    [data]
  );

  const suggestions = useMemo(() => {
    if (frames?.length && frames.every((df) => df.meta?.type === DataFrameType.TimeSeriesLong)) {
      const s = getPrepareTimeseriesSuggestion(id);
      return {
        message: 'Long data must be converted to wide',
        suggestions: s ? [s] : undefined,
      };
    }
    return undefined;
  }, [frames, id]);

  if (!frames || suggestions) {
    return (
      <PanelDataErrorView
        panelId={id}
        message={suggestions?.message}
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={true}
        needsNumberField={true}
        suggestions={suggestions?.suggestions}
      />
    );
  }

  const enableAnnotationCreation = Boolean(canAddAnnotations && (options.allowViewerAnnotation || canAddAnnotations()));

  return (
    <TimeSeries
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timezones}
      width={width}
      height={height}
      legend={options.legend}
      options={options}
    >
      {(config, alignedDataFrame) => {
        if (alignedDataFrame.fields.some((f) => Boolean(f.config.links?.length))) {
          alignedDataFrame = regenerateLinksSupplier(alignedDataFrame, frames, replaceVariables, timeZone);
        }

        const defaultContextMenuItems: MenuItemProps[] = scales.length
          ? [
              {
                label: 'Custom scales',
                ariaLabel: 'Custom scales',
                icon: 'channel-add',
                onClick: (e, p) => {
                  setTimescaleTriggerCoords(p.coords);
                  setAddingTimescale(true);
                  getTimescales();
                },
              },
            ]
          : [];

        return (
          <>
            <KeyboardPlugin config={config} />
            <ZoomPlugin config={config} onZoom={onChangeTimeRange} />
            {options.tooltip.mode === TooltipDisplayMode.None || (
              <TooltipPlugin
                frames={frames}
                data={alignedDataFrame}
                config={config}
                mode={options.tooltip.mode}
                sortOrder={options.tooltip.sort}
                sync={sync}
                timeZone={timeZone}
              />
            )}
            {/* Renders annotation markers*/}
            {data.annotations && (
              <AnnotationsPlugin annotations={data.annotations} config={config} timeZone={timeZone} />
            )}
            {/* Enables annotations creation*/}
            {enableAnnotationCreation ? (
              <AnnotationEditorPlugin data={alignedDataFrame} timeZone={timeZone} config={config} options={options}>
                {({ startAnnotating }) => {
                  return (
                    <ContextMenuPlugin
                      data={alignedDataFrame}
                      config={config}
                      timeZone={timeZone}
                      replaceVariables={replaceVariables}
                      defaultItems={[
                        {
                          items: [
                            {
                              label: 'Add annotation',
                              ariaLabel: 'Add annotation',
                              icon: 'comment-alt',
                              onClick: (e, p) => {
                                if (!p) {
                                  return;
                                }
                                startAnnotating({ coords: p.coords });
                              },
                            },
                            ...defaultContextMenuItems,
                          ],
                        },
                      ]}
                    />
                  );
                }}
              </AnnotationEditorPlugin>
            ) : (
              <ContextMenuPlugin
                data={alignedDataFrame}
                frames={frames}
                config={config}
                timeZone={timeZone}
                replaceVariables={replaceVariables}
                defaultItems={[
                  {
                    items: defaultContextMenuItems,
                  },
                ]}
              />
            )}
            {isAddingTimescale && (
              <TimescaleEditor
                onSave={onAddTimescale}
                onDismiss={() => setAddingTimescale(false)}
                scales={scales}
                style={{
                  position: 'absolute',
                  left: timescaleTriggerCoords?.viewport?.x,
                  top: timescaleTriggerCoords?.viewport?.y,
                }}
                timescalesFrame={timescalesFrame}
              />
            )}
            {data.annotations && (
              <ExemplarsPlugin
                visibleSeries={getVisibleLabels(config, frames)}
                config={config}
                exemplars={data.annotations}
                timeZone={timeZone}
                getFieldLinks={getFieldLinks}
              />
            )}
            {((canEditThresholds && onThresholdsChange) || showThresholds) && (
              <ThresholdControlsPlugin
                config={config}
                fieldConfig={fieldConfig}
                onThresholdsChange={canEditThresholds ? onThresholdsChange : undefined}
              />
            )}
            <OutsideRangePlugin config={config} onChangeTimeRange={onChangeTimeRange} />
          </>
        );
      }}
    </TimeSeries>
  );
};

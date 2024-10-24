import { config } from 'app/core/config';
import React, { useCallback, useMemo, useState } from 'react';
import { DashboardCursorSync, DataFrame, DataFrameType, PanelProps, toDataFrame, VizOrientation } from '@grafana/data';
import { getAppEvents, getBackendSrv, PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { Button, EventBusPlugin, KeyboardPlugin, TooltipPlugin2, usePanelContext } from '@grafana/ui';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { Options } from './panelcfg.gen';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { TimescaleEditor } from './plugins/timescales/TimescaleEditor';
import { TimescaleItem } from './plugins/timescales/TimescaleEditorForm';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { useRuntimeVariables } from './hooks';
import { getTimezones, prepareGraphableFields } from './utils';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { TimeSeriesTooltip } from './TimeSeriesTooltip';
import { AnnotationsPlugin2 } from './plugins/AnnotationsPlugin2';

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
  const {
    sync,
    eventsScope,
    canAddAnnotations,
    onThresholdsChange,
    canEditThresholds,
    showThresholds,
    dataLinkPostProcessor,
    eventBus,
  } = usePanelContext();

  const [isAddingTimescale, setAddingTimescale] = useState(false);
  const [timescaleTriggerCoords, setTimescaleTriggerCoords] = useState<{ left: number; top: number } | null>(null);

  const isVerticallyOriented = options.orientation === VizOrientation.Vertical;
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

  const { variable: wellVariable } = useRuntimeVariables(eventBus, options.variable);

  let well = '';
  if (
    wellVariable &&
    (wellVariable.type === 'query' || wellVariable.type === 'custom' || wellVariable.type === 'constant')
  ) {
    well = Array.isArray(wellVariable.current.value) ? wellVariable.current.value[0] : wellVariable.current.value;
  }

  const getTimescales = useCallback(async () => {
    const user = config.bootData.user;
    const userId = user?.id;
    const rawSql = `select min, max, metric from scales where user_id=${userId} and well='${well}';`;
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
  }, [data.request?.targets, well]);

  const onUpsertTimescale = useCallback(
    async (formData: TimescaleItem) => {
      const { min, max, description, scale, auto } = formData;
      const user = config.bootData.user;
      const userId = user?.id;
      const sanitizedDescription = description.replace(/\"|\'/g, '');
      const rawSql = `insert into scales values ('${well}', ${userId}, '${scale}', ${auto ? null : min}, ${
        auto ? null : max
      }, '${sanitizedDescription}') on conflict (well, user_id, metric) do update set min = excluded.min, max = excluded.max;`;
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
    },
    [data.request?.targets, well]
  );

  const onUpsertTimescales = useCallback(
    async (timescales: TimescaleItem[]) => {
      await Promise.all(timescales.map((timescale) => onUpsertTimescale(timescale)));

      /**
       * Publish refresh event
       */
      getAppEvents().publish({ type: 'variables-changed', payload: { refreshAll: true } });

      /**
       * Refresh timescales
       */
      await getTimescales();
    },
    [getTimescales, onUpsertTimescale]
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

  const enableAnnotationCreation = Boolean(canAddAnnotations && (options.allowViewerAnnotation || canAddAnnotations()));
  const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

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
      replaceVariables={replaceVariables}
      dataLinkPostProcessor={dataLinkPostProcessor}
      cursorSync={cursorSync}
    >
      {(uplotConfig, alignedFrame) => {
        return (
          <>
            <KeyboardPlugin config={uplotConfig} />
            {cursorSync !== DashboardCursorSync.Off && (
              <EventBusPlugin config={uplotConfig} eventBus={eventBus} frame={alignedFrame} />
            )}
            {options.tooltip.mode !== TooltipDisplayMode.None && (
              <TooltipPlugin2
                config={uplotConfig}
                hoverMode={
                  (options.tooltip.mode === TooltipDisplayMode.Single
                    ? TooltipHoverMode.xOne
                    : TooltipHoverMode.xAll) as never
                }
                queryZoom={onChangeTimeRange}
                clientZoom={true}
                syncMode={cursorSync}
                syncScope={eventsScope}
                render={(u, dataIdxs, seriesIdx, isPinned = false, dismiss, timeRange2, viaSync) => {
                  if (enableAnnotationCreation && timeRange2 != null) {
                    setNewAnnotationRange(timeRange2);
                    dismiss();
                    return;
                  }

                  const annotate = () => {
                    let xVal = u.posToVal(u.cursor.left!, 'x');

                    setNewAnnotationRange({ from: xVal, to: xVal });
                    dismiss();
                  };

                  return (
                    // not sure it header time here works for annotations, since it's taken from nearest datapoint index
                    <TimeSeriesTooltip
                      series={alignedFrame}
                      dataIdxs={dataIdxs}
                      seriesIdx={seriesIdx}
                      mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                      sortOrder={options.tooltip.sort}
                      isPinned={isPinned}
                      annotate={enableAnnotationCreation ? annotate : undefined}
                      maxHeight={options.tooltip.maxHeight}
                      footerContent={
                        <>
                          <Button
                            icon="channel-add"
                            variant="secondary"
                            size="sm"
                            id="custom-scales"
                            onClick={() => {
                              setTimescaleTriggerCoords({
                                left: u.rect.left + (u.cursor.left ?? 0),
                                top: u.rect.top + (u.cursor.top ?? 0),
                              });
                              setAddingTimescale(true);
                              getTimescales();
                              dismiss();
                            }}
                          >
                            Custom scales
                          </Button>
                        </>
                      }
                    />
                  );
                }}
                maxWidth={options.tooltip.maxWidth}
              />
            )}
            {!isVerticallyOriented && (
              <>
                <AnnotationsPlugin2
                  annotations={data.annotations ?? []}
                  config={uplotConfig}
                  timeZone={timeZone}
                  newRange={newAnnotationRange}
                  setNewRange={setNewAnnotationRange}
                />
                <OutsideRangePlugin config={uplotConfig} onChangeTimeRange={onChangeTimeRange} />
                {data.annotations && (
                  <ExemplarsPlugin
                    visibleSeries={getVisibleLabels(uplotConfig, frames)}
                    config={uplotConfig}
                    exemplars={data.annotations}
                    timeZone={timeZone}
                  />
                )}
                {((canEditThresholds && onThresholdsChange) || showThresholds) && (
                  <ThresholdControlsPlugin
                    config={uplotConfig}
                    fieldConfig={fieldConfig}
                    onThresholdsChange={canEditThresholds ? onThresholdsChange : undefined}
                  />
                )}
              </>
            )}
            {isAddingTimescale && (
              <TimescaleEditor
                onSave={onUpsertTimescales}
                onDismiss={() => setAddingTimescale(false)}
                scales={scales}
                style={{
                  position: 'absolute',
                  left: timescaleTriggerCoords?.left,
                  top: timescaleTriggerCoords?.top,
                }}
                timescalesFrame={timescalesFrame}
              />
            )}
          </>
        );
      }}
    </TimeSeries>
  );
};

// if (alignedFrame.fields.some((f) => Boolean(f.config.links?.length))) {
//   alignedFrame = regenerateLinksSupplier(alignedFrame, frames, replaceVariables, timeZone);
// }
//
// const defaultContextMenuItems: MenuItemProps[] = scales.length
//     ? [
//       {
//         label: 'Custom scales',
//         ariaLabel: 'Custom scales',
//         icon: 'channel-add',
//         onClick: (e, p: any) => {
//           setTimescaleTriggerCoords(p.coords);
//           setAddingTimescale(true);
//           getTimescales();
//         },
//       },
//     ]
//     : [];
//
// return (
//     <>
//       <KeyboardPlugin config={uplotConfig} />
//       <ZoomPlugin config={uplotConfig} onZoom={onChangeTimeRange} />
//       {options.tooltip.mode === TooltipDisplayMode.None || (
//           <TooltipPlugin
//               frames={frames}
//               data={alignedFrame}
//               config={uplotConfig}
//               mode={options.tooltip.mode}
//               sortOrder={options.tooltip.sort}
//               sync={sync}
//               timeZone={timeZone}
//           />
//       )}
//       {/* Renders annotation markers*/}
//       {data.annotations && (
//           <AnnotationsPlugin annotations={data.annotations} config={uplotConfig} timeZone={timeZone} />
//       )}
//       {/* Enables annotations creation*/}
//       {enableAnnotationCreation ? (
//           <AnnotationEditorPlugin data={alignedFrame} timeZone={timeZone} config={uplotConfig} options={options}>
//             {({ startAnnotating }) => {
//               return (
//                   <ContextMenuPlugin
//                       data={alignedFrame}
//                       tooltipMode={options.tooltip.mode}
//                       sortOrder={options.tooltip.sort}
//                       config={uplotConfig}
//                       timeZone={timeZone}
//                       replaceVariables={replaceVariables}
//                       eventBus={eventBus}
//                       width={width}
//                       height={height}
//                       defaultItems={[
//                         {
//                           items: [
//                             {
//                               label: 'Add annotation',
//                               ariaLabel: 'Add annotation',
//                               icon: 'comment-alt',
//                               onClick: (e, p) => {
//                                 if (!p) {
//                                   return;
//                                 }
//                                 startAnnotating({ coords: p.coords });
//                               },
//                             },
//                             ...defaultContextMenuItems,
//                           ],
//                         },
//                       ]}
//                   />
//               );
//             }}
//           </AnnotationEditorPlugin>
//       ) : (
//           <ContextMenuPlugin
//               data={alignedFrame}
//               frames={frames}
//               config={uplotConfig}
//               width={width}
//               height={height}
//               tooltipMode={options.tooltip.mode}
//               sortOrder={options.tooltip.sort}
//               timeZone={timeZone}
//               eventBus={eventBus}
//               replaceVariables={replaceVariables}
//               defaultItems={[
//                 {
//                   items: defaultContextMenuItems,
//                 },
//               ]}
//           />
//       )}
//       {isAddingTimescale && (
//           <TimescaleEditor
//               onSave={onUpsertTimescales}
//               onDismiss={() => setAddingTimescale(false)}
//               scales={scales}
//               style={{
//                 position: 'absolute',
//                 left: timescaleTriggerCoords?.viewport?.x,
//                 top: timescaleTriggerCoords?.viewport?.y,
//               }}
//               timescalesFrame={timescalesFrame}
//           />
//       )}
//       {data.annotations && (
//           <ExemplarsPlugin
//               visibleSeries={getVisibleLabels(uplotConfig, frames)}
//               config={uplotConfig}
//               exemplars={data.annotations}
//               timeZone={timeZone}
//           />
//       )}
//       {((canEditThresholds && onThresholdsChange) || showThresholds) && (
//           <ThresholdControlsPlugin
//               config={uplotConfig}
//               fieldConfig={fieldConfig}
//               onThresholdsChange={canEditThresholds ? onThresholdsChange : undefined}
//           />
//       )}
//       <OutsideRangePlugin config={uplotConfig} onChangeTimeRange={onChangeTimeRange} />
//     </>
// );

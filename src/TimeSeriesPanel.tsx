import { config } from 'app/core/config';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DashboardCursorSync, DataFrame, DataFrameType, PanelProps, toDataFrame, VizOrientation } from '@grafana/data';
import { getBackendSrv, PanelDataErrorView, TimeRangeUpdatedEvent } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';
import { Button, EventBusPlugin, KeyboardPlugin, TooltipPlugin2, usePanelContext } from '@grafana/ui';
import { useDashboardRefresh } from '@volkovlabs/components';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { Options } from './panelcfg.gen';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { TimescaleEditor } from './plugins/timescales/TimescaleEditor';
import { TimescaleItem } from './plugins/timescales/TimescaleEditorForm';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { useRuntimeVariables } from './hooks';
import { getTimezones, prepareGraphableFields } from './utils';
import { TimeRange2, TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';
import { TimeSeriesTooltip } from './TimeSeriesTooltip';
import { AnnotationsPlugin2 } from './plugins/AnnotationsPlugin2';
import { PinnedTooltip } from 'app/core/components/PinnedTooltip/PinnedTooltip';
import { PinnedPoint } from 'app/types';
import { OutsideConfigPlugins } from 'plugins/OutsideConfigPlugins';

interface TimeSeriesPanelProps extends PanelProps<Options> {}

const getPinnedPointKey = (dataIdxs: Array<number | null>, seriesIdx: number | null): string => {
  return `${seriesIdx}-${dataIdxs.join('-')}`;
};

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
  eventBus: panelEventBus,
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

  /**
   * State
   */
  const [isAddingTimescale, setAddingTimescale] = useState(false);
  const [triggerCoords, setTriggerCoords] = useState<{ left: number; top: number } | null>(null);

  const panelRoot = useRef<HTMLDivElement>(null);

  /**
   * Dashboard Refresh
   */
  const dashboardRefresh = useDashboardRefresh();

  const isVerticallyOriented = options.orientation === VizOrientation.Vertical;
  const frames = useMemo(() => prepareGraphableFields(data.series, config.theme2, timeRange), [data.series, timeRange]);
  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);

  /**
   * Timescales Frame
   * scales per well
   */
  const [timescalesFrame, setTimescalesFrame] = useState<DataFrame | null>(null);

  /**
   * Timescales Frame
   * global scales settings well eq. "GLOBAL_SCALES"
   */
  const [globalTimescalesFrame, setGlobalTimescalesFrame] = useState<DataFrame | null>(null);

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

  /**
   * Get timescales
   * scales per well
   */
  const getTimescales = useCallback(
    async (wellValue: string | null) => {
      const user = config.bootData.user;
      const userId = user?.id;
      const dashboardId = data.request?.dashboardUID;

      let rawSql = '';
      if (!wellValue) {
        /**
         * Get
         * global scales, well eq. "GLOBAL_SCALES"
         */
        rawSql = `select min, max, metric from scales where user_id=${userId} and dashboard_id='${dashboardId}' and well='GLOBAL_SCALES';`;
      } else {
        /**
         * Get
         * scales, based on well
         */
        rawSql = `select min, max, metric from scales where user_id=${userId} and dashboard_id='${dashboardId}' and well='${well}';`;
      }

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

        if (!wellValue) {
          /**
           * Global scales, well eq. "GLOBAL_SCALES"
           */
          setGlobalTimescalesFrame(toDataFrame(response.results?.[refId]?.frames[0]));
        } else {
          /**
           * Scales, based on well
           */
          setTimescalesFrame(toDataFrame(response.results?.[refId]?.frames[0]));
        }

        return;
      }

      if (!wellValue) {
        /**
         * Global scales, well eq. "GLOBAL_SCALES"
         */
        setGlobalTimescalesFrame(null);
      } else {
        /**
         * Scales, based on well
         */
        setTimescalesFrame(null);
      }
    },
    [data.request?.targets, well, data.request?.dashboardUID]
  );

  const onUpsertTimescale = useCallback(
    async (formData: TimescaleItem, isGlobal: boolean) => {
      const { min, max, description, scale, auto } = formData;
      const user = config.bootData.user;
      const userId = user?.id;
      const dashboardId = data.request?.dashboardUID;
      const sanitizedDescription = description.replace(/\"|\'/g, '');
      let rawSql = '';

      if (!isGlobal) {
        /**
         * Scales, based on well
         */
        rawSql = `insert into scales (well, user_id, dashboard_id, metric, min, max, description) \
        values ('${well}', ${userId}, '${dashboardId}', '${scale}', ${auto ? null : min}, ${
          auto ? null : max
        }, '${sanitizedDescription}') on conflict (well, user_id, dashboard_id, metric) do \
        update set min = excluded.min, max = excluded.max;`;
      } else {
        /**
         * Global scales, well eq. "GLOBAL_SCALES"
         */
        rawSql = `insert into scales (well, user_id, dashboard_id, metric, min, max, description) \
        values ('GLOBAL_SCALES', ${userId}, '${dashboardId}', '${scale}', ${auto ? null : min}, ${
          auto ? null : max
        }, '${sanitizedDescription}') on conflict (well, user_id, dashboard_id, metric) do \
        update set min = excluded.min, max = excluded.max;`;
      }

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
    [data.request?.dashboardUID, data.request?.targets, well]
  );

  const onUpsertTimescales = useCallback(
    async (timescales: TimescaleItem[], isGlobal: boolean) => {
      await Promise.all(timescales.map((timescale) => onUpsertTimescale(timescale, isGlobal)));

      /**
       * Refresh Dashboard
       */
      dashboardRefresh();

      /**
       * Refresh timescales
       */
      await getTimescales(well);

      /**
       * Global scales, well eq. "GLOBAL_SCALES"
       */
      await getTimescales(null);
    },
    [dashboardRefresh, getTimescales, well, onUpsertTimescale]
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
  const [pinnedPoints, setPinnedPoints] = useState<PinnedPoint[]>([]);

  /**
   * Clear Pinned Points on resize
   */
  useEffect(() => {
    setPinnedPoints([]);
  }, [width, height]);

  /**
   * Clear Pinned Points on time range change
   */
  useEffect(() => {
    const subscription = panelEventBus.getStream(TimeRangeUpdatedEvent).subscribe(() => {
      setPinnedPoints([]);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [panelEventBus]);

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
    <div ref={panelRoot}>
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
                      const xVal = u.posToVal(u.cursor.left!, 'x');

                      setNewAnnotationRange({ from: xVal, to: xVal });
                      dismiss();
                    };

                    const currentPointKey = getPinnedPointKey(dataIdxs, seriesIdx);
                    const isPinnedPointExists = pinnedPoints.some((pinnedPoint) => pinnedPoint.key === currentPointKey);

                    return (
                      <TimeSeriesTooltip
                        series={alignedFrame}
                        dataIdxs={dataIdxs}
                        seriesIdx={seriesIdx}
                        mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                        sortOrder={options.tooltip.sort}
                        isPinned={isPinned}
                        annotate={enableAnnotationCreation ? annotate : undefined}
                        maxHeight={options.tooltip.maxHeight}
                        headerContent={
                          <div>
                            {isPinnedPointExists ? (
                              <Button
                                size="sm"
                                fill="text"
                                icon="gf-pin"
                                onClick={() => {
                                  setPinnedPoints(
                                    pinnedPoints.filter((pinnedPoint) => pinnedPoint.key !== currentPointKey)
                                  );
                                  dismiss();
                                }}
                              />
                            ) : (
                              <Button
                                size="sm"
                                icon="gf-pin"
                                onClick={() => {
                                  setPinnedPoints([
                                    ...pinnedPoints,
                                    {
                                      dataIdxs: dataIdxs,
                                      seriesIdx,
                                      position: {
                                        left: u.cursor.left! + u.under.offsetLeft,
                                        top: u.cursor.top! + u.under.offsetTop,
                                      },
                                      key: currentPointKey,
                                    },
                                  ]);
                                  dismiss();
                                }}
                                fill="text"
                                variant="secondary"
                              />
                            )}
                          </div>
                        }
                        footerContent={
                          <>
                            <Button
                              icon="channel-add"
                              variant="secondary"
                              size="sm"
                              id="custom-scales"
                              onClick={() => {
                                setTriggerCoords({
                                  left: u.rect.left + (u.cursor.left ?? 0),
                                  top: u.rect.top + (u.cursor.top ?? 0),
                                });
                                setAddingTimescale(true);
                                getTimescales(well);
                                getTimescales(null);
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
              {panelRoot.current &&
                pinnedPoints.map((pinnedPoint, index) => {
                  return (
                    <PinnedTooltip
                      key={pinnedPoint.key}
                      pinnedPoint={pinnedPoint}
                      maxWidth={options.tooltip.maxWidth}
                      setPinnedPoints={() =>
                        setPinnedPoints(pinnedPoints.filter((item, itemIndex) => itemIndex !== index))
                      }
                      alignedFrame={alignedFrame}
                      sortOrder={options.tooltip.sort}
                      maxHeight={options.tooltip.maxHeight}
                      tooltipMode={options.tooltip.mode}
                      panelElement={panelRoot.current}
                    />
                  );
                })}
              {!isVerticallyOriented && (
                <>
                  <AnnotationsPlugin2
                    annotations={data.annotations ?? []}
                    config={uplotConfig}
                    timeZone={timeZone}
                    newRange={newAnnotationRange}
                    setNewRange={setNewAnnotationRange}
                    options={options}
                    variable={wellVariable}
                  />
                  <OutsideConfigPlugins
                    config={uplotConfig}
                    onChangeTimeRange={onChangeTimeRange}
                    frames={frames}
                    customScalesHandler={() => {
                      if (panelRoot.current) {
                        /**
                         * setTriggerCoords
                         */
                        const { right, bottom } = panelRoot.current?.getBoundingClientRect();
                        setTriggerCoords({ left: right / 2, top: bottom / 2 });
                      }
                      setAddingTimescale(true);
                      getTimescales(well);
                      getTimescales(null);
                    }}
                  />
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
                    left: triggerCoords?.left,
                    top: triggerCoords?.top,
                  }}
                  timescalesFrame={timescalesFrame}
                  globalTimescalesFrame={globalTimescalesFrame}
                />
              )}
            </>
          );
        }}
      </TimeSeries>
    </div>
  );
};

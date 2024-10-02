import { css as cssCore, Global } from '@emotion/react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CartesianCoords2D, DataFrame, EventBus, InterpolateFunction } from '@grafana/data';
import { SortOrder, TimeZone, TooltipDisplayMode } from '@grafana/schema';

import { MenuItemsGroup, UPlotConfigBuilder } from '@grafana/ui';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { ContextMenuView } from './ContextMenuView';

export type ContextMenuSelectionCoords = { viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D };
export type ContextMenuSelectionPoint = {
  seriesIdx: number | null;
  dataIdx: number | null;
  focusedPoints: Array<number | null>;
};

export interface ContextMenuItemClickPayload {
  coords: ContextMenuSelectionCoords;
}

export type ContextMenuSelectionItem = {
  point?: ContextMenuSelectionPoint | null;
  coords: ContextMenuSelectionCoords;
};

export type ContextMenuSelectionItems = ContextMenuSelectionItem[];

interface ContextMenuPluginProps {
  data: DataFrame;
  frames?: DataFrame[];
  config: UPlotConfigBuilder;
  defaultItems?: Array<MenuItemsGroup<ContextMenuItemClickPayload>>;
  timeZone: TimeZone;
  tooltipMode?: TooltipDisplayMode;
  eventBus: EventBus;
  sortOrder: SortOrder;
  width: number;
  height: number;
  onOpen?: () => void;
  onClose?: () => void;
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuPlugin = ({
  data,
  config,
  onClose,
  timeZone,
  sortOrder,
  width,
  height,
  eventBus,
  replaceVariables,
  tooltipMode,
  ...otherProps
}: ContextMenuPluginProps) => {
  /**
   * State
   */
  const plotCanvas = useRef<HTMLDivElement>();
  const [coords, setCoords] = useState<ContextMenuSelectionCoords | null>(null);
  const [point, setPoint] = useState<ContextMenuSelectionPoint | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pinnedPoints, setPinnedPoints] = useState<ContextMenuSelectionItems>([]);

  /**
   * Dashboard refs
   */
  const dashboardScrollViewRef = useRef<HTMLDivElement | null>(null);

  const openMenu = useCallback(() => {
    setIsOpen(true);
  }, [setIsOpen]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const clearSelection = useCallback(() => {
    setPoint(null);
  }, [setPoint]);

  useEffect(() => {
    /**
     * Update pinned points on TimeRangeUpdatedEvent
     */
    const subscriber = eventBus.getStream(TimeRangeUpdatedEvent).subscribe(() => {
      setPinnedPoints([]);
    });

    return () => {
      subscriber.unsubscribe();
    };
  }, [eventBus]);

  useLayoutEffect(() => {
    /**
     * Set scrollbar view element
     * Several scrollbar view elements exist
     * We have to specify particular element
     */
    if (!dashboardScrollViewRef.current) {
      dashboardScrollViewRef.current = document.querySelector('.main-view .scrollbar-view');
    }

    const handleScroll = () => {
      /**
       * Clear pinned points
       */
      if (!!pinnedPoints.length) {
        setPinnedPoints([]);
      }

      /**
       * Clear current point
       */
      if (!!coords && !!point) {
        setPoint(null);
        setCoords(null);
      }
    };

    /**
     * Listen for Scroll events
     */
    if (dashboardScrollViewRef.current) {
      dashboardScrollViewRef.current.addEventListener('scroll', handleScroll);

      return () => {
        dashboardScrollViewRef.current?.removeEventListener('scroll', handleScroll);
      };
    }

    return () => {};
  }, [coords, pinnedPoints.length, point]);

  /**
   * Clear pinned points on panel size change
   */
  useEffect(() => {
    setPinnedPoints([]);
  }, [height, width]);

  // Add uPlot hooks to the config, or re-add when the config changed
  useLayoutEffect(() => {
    let bbox: DOMRect | undefined = undefined;

    const onMouseCapture = (e: MouseEvent) => {
      let update = {
        viewport: {
          x: e.clientX,
          y: e.clientY,
        },
        plotCanvas: {
          x: 0,
          y: 0,
        },
      };
      if (bbox) {
        update = {
          ...update,
          plotCanvas: {
            x: e.clientX - bbox.left,
            y: e.clientY - bbox.top,
          },
        };
      }
      setCoords(update);
    };

    // cache uPlot plotting area bounding box
    config.addHook('syncRect', (u, rect) => {
      bbox = rect;
    });

    config.addHook('init', (u) => {
      const canvas = u.over;
      plotCanvas.current = canvas || undefined;
      plotCanvas.current?.addEventListener('mousedown', onMouseCapture);

      // for naive click&drag check
      let isClick = false;

      // REF: https://github.com/leeoniya/uPlot/issues/239
      let pts = Array.from(u.root.querySelectorAll<HTMLDivElement>('.u-cursor-pt'));

      plotCanvas.current?.addEventListener('mousedown', () => {
        isClick = true;
      });

      plotCanvas.current?.addEventListener('mousemove', () => {
        isClick = false;
      });

      // TODO: remove listeners on unmount
      plotCanvas.current?.addEventListener('mouseup', (e: MouseEvent) => {
        // ignore cmd+click, this is handled by annotation editor
        if (!isClick || e.metaKey || e.ctrlKey) {
          setPoint(null);
          return;
        }
        isClick = true;

        if (e.target instanceof HTMLElement) {
          if (!e.target.classList.contains('u-cursor-pt')) {
            setPoint({ seriesIdx: null, dataIdx: null, focusedPoints: [] });
          }
        }
        openMenu();
      });

      if (pts.length > 0) {
        pts.forEach((pt, i) => {
          // TODO: remove listeners on unmount
          pt.addEventListener('click', () => {
            const seriesIdx = i + 1;
            const dataIdx = u.cursor.idx;
            setPoint({
              seriesIdx,
              dataIdx: dataIdx ?? null,
              focusedPoints: u.legend.idxs!.slice(),
            });
          });
        });
      }
    });
  }, [config, openMenu, pinnedPoints, setCoords, setPoint]);

  const defaultItems = useMemo(() => {
    return otherProps.defaultItems
      ? otherProps.defaultItems.map((i) => {
          return {
            ...i,
            items: i.items.map((j) => {
              return {
                ...j,
                onClick: (e: React.MouseEvent<HTMLElement>) => {
                  if (!coords) {
                    return;
                  }

                  j.onClick?.(e, { coords });
                },
              };
            }),
          };
        })
      : [];
  }, [coords, otherProps.defaultItems]);

  /**
   * Available Pinned Points except current selected point
   */
  const availablePinnedPoints = useMemo(() => {
    return pinnedPoints.filter(
      (pinPoint) =>
        pinPoint.point?.dataIdx !== point?.dataIdx || !pinPoint.point?.focusedPoints.includes(point?.dataIdx || null)
    );
  }, [pinnedPoints, point]);

  return (
    <>
      <Global
        styles={cssCore`
        .uplot .u-cursor-pt {
          pointer-events: auto !important;
        }
      `}
      />
      {isOpen && coords && (
        <ContextMenuView
          key={point?.dataIdx}
          pinnedPoints={pinnedPoints}
          setPinnedPoints={setPinnedPoints}
          data={data}
          sortOrder={sortOrder}
          frames={otherProps.frames}
          defaultItems={defaultItems}
          timeZone={timeZone}
          tooltipMode={tooltipMode}
          selection={{ point, coords }}
          replaceVariables={replaceVariables}
          onClose={() => {
            clearSelection();
            closeMenu();
            if (onClose) {
              onClose();
            }
          }}
        />
      )}
      {availablePinnedPoints.map((pin) => (
        <ContextMenuView
          key={pin.point?.dataIdx}
          pinnedPoints={pinnedPoints}
          setPinnedPoints={setPinnedPoints}
          data={data}
          sortOrder={sortOrder}
          frames={otherProps.frames}
          defaultItems={defaultItems}
          tooltipMode={tooltipMode}
          timeZone={timeZone}
          replaceVariables={replaceVariables}
          selection={pin}
        />
      ))}
    </>
  );
};

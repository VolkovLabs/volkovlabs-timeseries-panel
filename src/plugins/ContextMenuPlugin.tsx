import { css as cssCore, Global } from '@emotion/react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useClickAway } from 'react-use';
import {
  arrayUtils,
  CartesianCoords2D,
  DataFrame,
  EventBus,
  FALLBACK_COLOR,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  InterpolateFunction,
} from '@grafana/data';
import { SortOrder, TimeZone, TooltipDisplayMode } from '@grafana/schema';

import {
  ContextMenu,
  IconButton,
  MenuGroup,
  MenuItem,
  MenuItemProps,
  MenuItemsGroup,
  SeriesTable,
  SeriesTableRowProps,
  UPlotConfigBuilder,
  useTheme2,
} from '@grafana/ui';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';

type ContextMenuSelectionCoords = { viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D };
type ContextMenuSelectionPoint = {
  seriesIdx: number | null;
  dataIdx: number | null;
  focusedPoints: Array<number | null>;
};

export interface ContextMenuItemClickPayload {
  coords: ContextMenuSelectionCoords;
}

type ContextMenuSelectionItem = {
  point?: ContextMenuSelectionPoint | null;
  coords: ContextMenuSelectionCoords;
};

type ContextMenuSelectionItems = ContextMenuSelectionItem[];

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
  const [panelSizes, setPanelSizes] = useState({
    width,
    height,
  });

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

  useEffect(() => {
    if (panelSizes.height !== height || panelSizes.width !== width) {
      setPinnedPoints([]);
      setPanelSizes({
        height,
        width,
      });
    }
  }, [height, panelSizes.height, panelSizes.width, width]);
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

interface ContextMenuViewProps {
  data: DataFrame;
  frames?: DataFrame[];
  defaultItems?: MenuItemsGroup[];
  timeZone: TimeZone;
  sortOrder: SortOrder;
  pinnedPoints: ContextMenuSelectionItems;
  tooltipMode?: TooltipDisplayMode;
  setPinnedPoints: React.Dispatch<React.SetStateAction<ContextMenuSelectionItems>>;
  onClose?: () => void;
  selection: ContextMenuSelectionItem;
  replaceVariables?: InterpolateFunction;
}

export const ContextMenuView = ({
  selection,
  timeZone,
  defaultItems,
  replaceVariables,
  pinnedPoints,
  tooltipMode,
  sortOrder,
  setPinnedPoints,
  data,
  ...otherProps
}: ContextMenuViewProps) => {
  /**
   * Styles
   */
  const theme = useTheme2();

  /**
   * ref
   */
  const ref = useRef(null);

  /**
   * isPinned current point
   */
  const isPinned = useMemo(() => {
    return pinnedPoints.some((point) => point.point?.dataIdx === selection.point?.dataIdx);
  }, [pinnedPoints, selection.point?.dataIdx]);

  /**
   * onClose
   */
  const onClose = () => {
    if (otherProps.onClose) {
      otherProps.onClose();
    }
  };

  useClickAway(ref, () => {
    onClose();
  });

  const xField = data.fields[0];

  if (!xField) {
    return null;
  }
  const items = defaultItems ? [...defaultItems] : [];
  let renderHeader: () => React.JSX.Element | null = () => null;
  let tooltip: React.ReactNode = null;

  if (selection.point) {
    const { seriesIdx, dataIdx, focusedPoints } = selection.point;
    const xFieldFmt = xField.display!;

    if (seriesIdx && dataIdx !== null) {
      const field = data.fields[seriesIdx];
      const hasLinks = field.config.links && field.config.links.length > 0;
      let xVal = xFieldFmt(xField!.values[dataIdx]).text;

      if (hasLinks) {
        if (field.getLinks) {
          items.push({
            items: field
              .getLinks({
                valueRowIndex: dataIdx,
              })
              .map<MenuItemProps>((link) => {
                return {
                  label: link.title,
                  ariaLabel: link.title,
                  url: link.href,
                  target: link.target,
                  icon: link.target === '_self' ? 'link' : 'external-link-alt',
                  onClick: link.onClick,
                };
              }),
          });
        }
      }

      if (tooltipMode === TooltipDisplayMode.Single || tooltipMode === TooltipDisplayMode.None) {
        if (!field) {
          return null;
        }

        const dataIdxCurrent = focusedPoints?.[seriesIdx] ?? dataIdx;
        xVal = xFieldFmt(xField!.values[dataIdxCurrent]).text;
        const fieldFmt = field.display || getDisplayProcessor({ field, timeZone, theme });
        const display = fieldFmt(field.values[dataIdxCurrent]);

        tooltip = (
          <SeriesTable
            series={[
              {
                color: display.color,
                label: getFieldDisplayName(field, data, otherProps.frames),
                value: display ? formattedValueToString(display) : null,
              },
            ]}
            timestamp={xVal}
          />
        );
      }

      if (tooltipMode === TooltipDisplayMode.Multi) {
        let series: SeriesTableRowProps[] = [];
        const frame = data;
        const fields = frame.fields;
        const sortIdx: unknown[] = [];

        for (let i = 0; i < fields.length; i++) {
          const field = frame.fields[i];
          if (
            !field ||
            field === xField ||
            field.type === FieldType.time ||
            field.type !== FieldType.number ||
            field.config.custom?.hideFrom?.tooltip ||
            field.config.custom?.hideFrom?.viz
          ) {
            continue;
          }

          const v = data.fields[i].values[focusedPoints[i]!];
          const display = field.display!(v);

          sortIdx.push(v);
          series.push({
            color: display.color || FALLBACK_COLOR,
            label: getFieldDisplayName(field, frame, otherProps.frames),
            value: display ? formattedValueToString(display) : null,
            isActive: seriesIdx === i,
          });
        }

        if (sortOrder !== SortOrder.None) {
          const sortRef = [...series];
          const sortFn = arrayUtils.sortValues(sortOrder);

          series.sort((a, b) => {
            const aIdx = sortRef.indexOf(a);
            const bIdx = sortRef.indexOf(b);
            return sortFn(sortIdx[aIdx], sortIdx[bIdx]);
          });
        }

        tooltip = <SeriesTable series={series} timestamp={xVal} />;
      }

      /**
       * Render header menu
       */
      // eslint-disable-next-line react/display-name
      renderHeader = () => (
        <>
          <div>
            <IconButton
              name="gf-pin"
              tooltip="Pin"
              tooltipPlacement="right"
              size="sm"
              variant={isPinned ? 'primary' : 'secondary'}
              onClick={(event) => {
                event.stopPropagation();
                /**
                 * Pin/unpin handler
                 */
                if (isPinned) {
                  const filteredPoints = pinnedPoints.filter(
                    (point) => point.point?.dataIdx !== selection.point?.dataIdx
                  );
                  setPinnedPoints(filteredPoints);
                } else {
                  setPinnedPoints([...pinnedPoints, selection]);
                }
              }}
            />
          </div>
          {tooltip}
        </>
      );
    }
  }

  /**
   * Render menu items
   */
  const renderMenuGroupItems = () => {
    return items?.map((group, index) => (
      <MenuGroup key={`${group.label}${index}`} label={group.label}>
        {(group.items || []).map((item) => (
          <MenuItem
            key={item.label}
            url={item.url}
            label={item.label}
            target={item.target}
            icon={item.icon}
            active={item.active}
            onClick={item.onClick}
          />
        ))}
      </MenuGroup>
    ));
  };

  return (
    <ContextMenu
      renderMenuItems={isPinned ? undefined : renderMenuGroupItems}
      renderHeader={renderHeader}
      x={selection.coords.viewport.x}
      y={selection.coords.viewport.y}
      onClose={onClose}
    />
  );
};

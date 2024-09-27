import React, { useMemo, useRef } from 'react';
import { useClickAway } from 'react-use';
import {
  arrayUtils,
  DataFrame,
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
  useTheme2,
} from '@grafana/ui';

import { ContextMenuSelectionItem, ContextMenuSelectionItems } from './ContextMenuPlugin';

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

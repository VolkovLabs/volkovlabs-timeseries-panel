import { css } from '@emotion/css';
import React, { ReactNode, useEffect, useRef } from 'react';

import { DataFrame, Field, FieldType, formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { VizTooltipContent } from '@grafana/ui/src/components/VizTooltip/VizTooltipContent';
import { VizTooltipFooter } from '@grafana/ui/src/components/VizTooltip/VizTooltipFooter';
import { VizTooltipHeader } from '@grafana/ui/src/components/VizTooltip/VizTooltipHeader';
import { VizTooltipItem } from '@grafana/ui/src/components/VizTooltip/types';
import { getContentItems } from '@grafana/ui/src/components/VizTooltip/utils';

import { getDataLinks } from './app/plugins/panel/status-history/utils';
import { fmt } from './app/plugins/panel/xychart/utils';

import { isTooltipScrollable } from './utils';

// exemplar / annotation / time region hovering?
// add annotation UI / alert dismiss UI?

export interface TimeSeriesTooltipProps {
  // aligned series frame
  series: DataFrame;

  // aligned fields that are not series
  _rest?: Field[];

  // hovered points
  dataIdxs: Array<number | null>;
  // closest/hovered series
  seriesIdx?: number | null;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;

  isPinned: boolean;

  annotate?: () => void;
  maxHeight?: number;

  /**
   * Header Content
   */
  headerContent?: ReactNode;

  /**
   * Footer Content
   */
  footerContent?: ReactNode;

  /**
   * Footer Content
   */
  panelElement?: HTMLDivElement | null;
}

export const TimeSeriesTooltip = ({
  series,
  _rest,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  annotate,
  maxHeight,
  headerContent = null,
  footerContent = null,
  panelElement,
}: TimeSeriesTooltipProps) => {
  /**
   * Theme and styles
   */
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  /**
   * Ref
   */
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) {
      return;
    }

    let lastTop = 0;
    let lastLeft = 0;
    let frameId: number;

    const checkPosition = () => {
      const rect = el.getBoundingClientRect();
      const position = el.style.position;

      if (rect.top !== lastTop || rect.left !== lastLeft) {
        lastTop = rect.top;
        lastLeft = rect.left;

        /**
         * Reset positions after unpin
         */
        if (!isPinned && position === 'absolute') {
          el.style.position = 'unset';
          el.style.top = `unset`;
          el.style.bottom = `unset`;
        }

        console.log('POSITION CHANGED FINISH');
        el.style.borderColor = 'blue';
      }

      /**
       * Use for seamless reset "pined" position
       */
      frameId = requestAnimationFrame(checkPosition);
    };

    checkPosition();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [isPinned, panelElement]);

  useEffect(() => {
    const el = tooltipRef.current;

    if (!el || !isPinned || !panelElement) {
      return;
    }

    /**
     * Update pinned tooltip position
     */
    const rect = el.getBoundingClientRect();
    const { bottom: panelBottom } = panelElement.getBoundingClientRect();
    const viewportBottom = window.innerHeight;

    /**
     * Checks
     */
    const isPanelOutOfView = panelBottom > viewportBottom;
    const isTooltipOutOfPanel = rect.bottom > panelBottom;

    if (isTooltipOutOfPanel) {
      let currentOffset = rect.bottom - panelBottom;

      /**
       * Checking that the tooltip does not go beyond the upper limits of the viewport when changing its position
       */
      const isOutOfViewTop = rect.top - currentOffset < 0;

      if (isOutOfViewTop) {
        currentOffset = rect.top;
      }

      el.style.top = `-${currentOffset}px`;
      el.style.position = 'absolute';
      return;
    }

    /**
     * If panel lower then viewport
     * The tooltip is displayed too high above the cursor
     * we need to correct this
     * +10 creates a drop-off from the viewport area
     */
    if (isPanelOutOfView) {
      const tooltipNearBottomOfView = rect.bottom - viewportBottom;
      el.style.position = 'absolute';
      el.style.bottom = `${tooltipNearBottomOfView + 10}px`;

      return;
    }
  }, [isPinned, panelElement]);

  const xField = series.fields[0];
  const xVal = formattedValueToString(xField.display!(xField.values[dataIdxs[0]!]));

  const contentItems = getContentItems(
    series.fields,
    xField,
    dataIdxs,
    seriesIdx,
    mode,
    sortOrder,
    (field) => field.type === FieldType.number || field.type === FieldType.enum
  );

  _rest?.forEach((field) => {
    if (!field.config.custom?.hideFrom?.tooltip) {
      contentItems.push({
        label: field.state?.displayName ?? field.name,
        value: fmt(field, field.values[dataIdxs[0]!]),
      });
    }
  });

  let footer: ReactNode;

  if (isPinned && seriesIdx != null) {
    const field = series.fields[seriesIdx];
    const dataIdx = dataIdxs[seriesIdx]!;
    const links = getDataLinks(field, dataIdx);

    footer = (
      <>
        <VizTooltipFooter dataLinks={links} annotate={annotate} />
        {footerContent && <div className={styles.footerContent}>{footerContent}</div>}
      </>
    );
  }

  const headerItem: VizTooltipItem | null = xField.config.custom?.hideFrom?.tooltip
    ? null
    : {
        label: xField.type === FieldType.time ? '' : (xField.state?.displayName ?? xField.name),
        value: xVal,
      };

  return (
    <div
      ref={tooltipRef}
      style={{
        zIndex: theme.zIndex.portal,
        whiteSpace: 'pre',
        borderRadius: theme.shape.radius.default,
        background: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.weak}`,
        boxShadow: theme.shadows.z2,
      }}
      className={styles.wrapper}
    >
      {isPinned && headerContent}
      {headerItem != null && <VizTooltipHeader item={headerItem} isPinned={isPinned} />}
      <VizTooltipContent
        items={contentItems}
        isPinned={isPinned}
        scrollable={isTooltipScrollable({ mode, maxHeight })}
        maxHeight={maxHeight}
      />
      {footer}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid yellow',
  }),
  footerContent: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
});

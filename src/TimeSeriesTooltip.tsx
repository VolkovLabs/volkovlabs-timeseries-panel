import { css } from '@emotion/css';
import React, { ReactNode } from 'react';

import { DataFrame, Field, FieldType, formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { useStyles2 } from '@grafana/ui';
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
}: TimeSeriesTooltipProps) => {
  const styles = useStyles2(getStyles);

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
    <div className={styles.wrapper}>
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
  }),
  footerContent: css({
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
});

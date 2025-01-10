import React, { useEffect, useRef, useState } from 'react';

import { DataFrame } from '@grafana/data';
import { Button, useTheme2 } from '@grafana/ui';
import { TimeSeriesTooltip } from '../../../../TimeSeriesTooltip';
import { PinnedPoint } from 'app/types';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

type Props = {
  pinnedPoint: PinnedPoint;
  maxWidth?: number;
  maxHeight?: number;
  sortOrder: SortOrder;
  alignedFrame: DataFrame;
  panelElement: HTMLDivElement | null;
  tooltipMode: TooltipDisplayMode;
  setPinnedPoints: () => void;
};

export const PinnedTooltip = ({
  pinnedPoint,
  maxWidth,
  setPinnedPoints,
  alignedFrame,
  sortOrder,
  maxHeight,
  tooltipMode,
  panelElement,
}: Props) => {
  /**
   * Theme
   */
  const theme = useTheme2();

  /**
   * Ref
   */
  const pointRef = useRef<HTMLDivElement>(null);

  /**
   * States
   */
  const [topPosition, setTopPosition] = useState(pinnedPoint.position.top);

  useEffect(() => {
    const adjustPointPosition = () => {
      if (!pointRef.current || !panelElement) {
        return;
      }

      const panelBottom = panelElement.getBoundingClientRect().bottom;
      const tooltipBottom = pointRef.current.getBoundingClientRect().bottom;

      if (tooltipBottom > panelBottom) {
        const offset = tooltipBottom - panelBottom;
        const newTop = pointRef.current.offsetTop - offset;

        setTopPosition(newTop);
      }
    };

    adjustPointPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={pointRef}
      style={{
        position: 'absolute',
        left: pinnedPoint.position.left + 5,
        top: topPosition + 5,
        backgroundColor: theme.components.tooltip.background,
        zIndex: theme.zIndex.portal,
        whiteSpace: 'pre',
        borderRadius: theme.shape.radius.default,
        background: theme.colors.background.primary,
        border: `1px solid ${theme.colors.border.weak}`,
        boxShadow: theme.shadows.z2,
        userSelect: 'text',
        maxWidth: maxWidth ?? 'none',
      }}
    >
      <Button icon="gf-pin" size="sm" fill="text" onClick={setPinnedPoints} />
      <TimeSeriesTooltip
        series={alignedFrame}
        dataIdxs={pinnedPoint.dataIdxs}
        seriesIdx={pinnedPoint.seriesIdx}
        sortOrder={sortOrder}
        isPinned={false}
        maxHeight={maxHeight}
        mode={tooltipMode}
      />
    </div>
  );
};

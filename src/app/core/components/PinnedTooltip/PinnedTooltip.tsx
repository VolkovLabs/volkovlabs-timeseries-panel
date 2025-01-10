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
  const [leftPosition, setLeftPosition] = useState(pinnedPoint.position.left);

  useEffect(() => {
    const adjustPointPosition = () => {
      if (!pointRef.current || !panelElement) {
        return;
      }
      /**
       * Position points
       */
      const { bottom: panelBottom, right: panelRight } = panelElement.getBoundingClientRect();
      const { bottom: tooltipBottom, right: tooltipRight } = pointRef.current.getBoundingClientRect();

      if (tooltipRight > panelRight) {
        const offset = tooltipRight - panelRight;
        const newLeft = pinnedPoint.position.left - offset;

        setLeftPosition(newLeft);
      }

      if (tooltipBottom > panelBottom) {
        const offset = tooltipBottom - panelBottom;
        const newTop = pointRef.current.offsetTop - offset;

        setTopPosition(newTop);
      }
    };

    adjustPointPosition();
  }, [panelElement, pinnedPoint.position.left]);

  return (
    <div
      ref={pointRef}
      style={{
        position: 'absolute',
        left: leftPosition + 5,
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

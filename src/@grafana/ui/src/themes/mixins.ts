import { GrafanaTheme2 } from '@grafana/data';
import { CSSObject } from '@emotion/css';

// max-width is set up based on .grafana-tooltip class that's used in dashboard
export const getTooltipContainerStyles = (theme: GrafanaTheme2) => `
  overflow: hidden;
  background: ${theme.colors.background.secondary};
  box-shadow: ${theme.shadows.z2};
  max-width: 800px;
  padding: ${theme.spacing(1)};
  border-radius: ${theme.shape.radius.default};
  z-index: ${theme.zIndex.tooltip};
`;

export function getFocusStyles(theme: GrafanaTheme2): CSSObject {
  return {
    outline: '2px dotted transparent',
    outlineOffset: '2px',
    boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
    transitionTimingFunction: `cubic-bezier(0.19, 1, 0.22, 1)`,
    transitionDuration: '0.2s',
    transitionProperty: 'outline, outline-offset, box-shadow',
  };
}

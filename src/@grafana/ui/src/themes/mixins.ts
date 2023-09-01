import { GrafanaTheme2 } from '@grafana/data';

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

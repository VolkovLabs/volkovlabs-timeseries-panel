import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

/**
 * Styles
 */
export const Styles = (theme: GrafanaTheme2) => {
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    table: css`
      border-radius: ${theme.shape.radius.default};
      width: 100%;

      td {
        padding: ${theme.spacing(0.5, 1)};

        &:not(:last-child) {
          border-right: 1px solid ${theme.colors.border.weak};
        }
      }
    `,
    disableGrow: css`
      width: 0;
    `,
    header: css`
      position: sticky;
      background-color: ${theme.colors.background.primary};
      box-shadow: 0 1px ${theme.colors.border.weak};
    `,
    headerCell: css`
      padding: ${theme.spacing(1)};
    `,
    row: css`
      border-bottom: 1px solid ${theme.colors.border.weak};

      &:hover {
        background-color: ${rowHoverBg};
      }

      &:last-child {
        border-bottom: 0;
      }
    `,
    cellCenter: css`
      text-align: center;
    `,
  };
};

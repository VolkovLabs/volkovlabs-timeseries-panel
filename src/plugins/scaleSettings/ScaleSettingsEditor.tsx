import React, { HTMLAttributes, useEffect, useRef, useState } from 'react';
import {
  IconButton,
  InlineField,
  InlineFieldRow,
  Portal,
  RadioButtonGroup,
  Select,
  Stack,
  useStyles2,
} from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import useClickAway from 'react-use/lib/useClickAway';
import { css } from '@emotion/css';

import { UserSettings } from 'app/types/userSettings';

/**
 * Scale type
 */
type ScaleType = 'linear' | 'log';

/**
 * Scale type options
 */
const scaleTypeOptions: Array<SelectableValue<ScaleType>> = [
  {
    label: 'Linear',
    value: 'linear',
  },
  {
    label: 'Logarithmic',
    value: 'log',
  },
];

/**
 * log base options
 */
const logOptions: Array<SelectableValue<number>> = [
  {
    label: '2',
    value: 2,
  },
  {
    label: '10',
    value: 10,
  },
];

/**
 * Scale settings editor props
 */
interface ScaleSettingsEditorProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (settings: UserSettings) => void;
  onDismiss: () => void;
  userSettings: UserSettings;
}

/**
 * Scale settings editor
 */
export const ScaleSettingsEditor: React.FC<ScaleSettingsEditorProps> = ({ onDismiss, onSave, style, userSettings }) => {
  /**
   * Styles
   */
  const styles = useStyles2(getStyles);

  /**
   * State
   */
  const [scale, setScale] = useState(userSettings.scaleDistribution?.type || 'linear');
  const [log, setLog] = useState(userSettings.scaleDistribution?.log || 2);

  const clickAwayRef = useRef<HTMLDivElement>(null);
  const wrapEditorRef = useRef<HTMLDivElement>(null);

  useClickAway(wrapEditorRef, () => {
    onDismiss();
  });

  useEffect(() => {
    const el = wrapEditorRef.current;
    if (!el) {
      return;
    }

    let frameId: number;

    const checkPosition = () => {
      const rect = el.getBoundingClientRect();
      /**
       * Checks
       */
      const isPanelOutOfBottomView = rect.bottom > window.innerHeight;
      const isPanelOutOfRightView = rect.right > window.innerWidth;

      if (isPanelOutOfBottomView) {
        const offset = rect.bottom - window.innerHeight;
        /**
         * 50px gap near bottom
         */
        const updatedTop = rect.top - offset - 50;
        el.style.top = `${updatedTop}px`;
      }

      if (isPanelOutOfRightView) {
        const offsetRight = rect.right - window.innerWidth;
        /**
         * 50px gap near bottom
         */
        const updatedLeft = rect.left - offsetRight - 50;
        el.style.left = `${updatedLeft}px`;
      }

      frameId = requestAnimationFrame(checkPosition);
    };

    checkPosition();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <Portal>
      <>
        <div ref={wrapEditorRef} style={style}>
          <div className={styles.editor} ref={clickAwayRef}>
            <div className={styles.header}>
              <Stack justifyContent={'space-between'} alignItems={'center'}>
                <div className={styles.title}>Linear/Logarithmic settings</div>
                <IconButton name="times" aria-label="Close" onClick={onDismiss} />
              </Stack>
            </div>
            <div>
              <InlineFieldRow className={styles.container}>
                <InlineField labelWidth={15} label="Scale">
                  <RadioButtonGroup
                    value={scale}
                    options={scaleTypeOptions}
                    onChange={(value) => {
                      setScale(value);
                      onSave({
                        ...userSettings,
                        scaleDistribution: {
                          ...userSettings.scaleDistribution,
                          type: value,
                          log: value === 'linear' ? undefined : 2,
                        },
                      });
                    }}
                  />
                </InlineField>
                {scale === 'log' && (
                  <InlineField labelWidth={15} label="Log base">
                    <Select
                      value={log}
                      options={logOptions}
                      onChange={(value) => {
                        setLog(value.value as number);
                        onSave({
                          ...userSettings,
                          scaleDistribution: {
                            type: 'log',
                            log: value.value as number,
                          },
                        });
                      }}
                    />
                  </InlineField>
                )}
              </InlineFieldRow>
            </div>
          </div>
        </div>
      </>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    editor: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.dropdown};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      width: 460px;
    `,
    header: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      padding: ${theme.spacing(1.5, 1)};
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    container: css`
      padding: ${theme.spacing(2)};
      display: flex;
    `,
  };
};

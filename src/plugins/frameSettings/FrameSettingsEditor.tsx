import React, { HTMLAttributes, useMemo, useRef, useState } from 'react';
import { usePopper } from 'react-popper';
import { AxisPlacement, IconButton, Portal, RadioButtonGroup, Stack, useStyles2 } from '@grafana/ui';
import { DataFrame, FieldType, GrafanaTheme2 } from '@grafana/data';
import useClickAway from 'react-use/lib/useClickAway';
import { css } from '@emotion/css';
import { FieldSettings } from 'app/types/frameSettings';

interface FrameSettingsEditorProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (settings: FieldSettings[]) => void;
  onDismiss: () => void;
  fieldSettings: FieldSettings[];
  frames: DataFrame[];
}

/**
 * Display Options
 */
const placementOptions = [
  {
    value: AxisPlacement.Auto,
    label: 'Auto',
    description: 'First field on the left, everything else on the right',
  },
  {
    value: AxisPlacement.Left,
    label: 'Left',
  },
  {
    value: AxisPlacement.Right,
    label: 'Right',
  },
];

export const FrameSettingsEditor: React.FC<FrameSettingsEditorProps> = ({
  onDismiss,
  onSave,
  style,
  frames,
  fieldSettings,
}) => {
  const styles = useStyles2(getStyles);

  const [popperTrigger, setPopperTrigger] = useState<HTMLDivElement | null>(null);
  const [editorPopover, setEditorPopover] = useState<HTMLDivElement | null>(null);

  const clickAwayRef = useRef<HTMLDivElement>(null);

  const fields = useMemo(
    () =>
      frames.flatMap((frame) =>
        frame.fields
          .filter((field) => field.type !== FieldType.time)
          .map((field) => ({
            ...field,
            refId: frame.refId,
          }))
      ),
    [frames]
  );

  useClickAway(clickAwayRef, () => {
    onDismiss();
  });

  const popper = usePopper(popperTrigger, editorPopover, {
    modifiers: [
      { name: 'arrow', enabled: false },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          rootBoundary: 'viewport',
        },
      },
    ],
  });

  return (
    <Portal>
      <>
        <div ref={setPopperTrigger} style={style} />
        <div ref={setEditorPopover} style={popper.styles.popper} {...popper.attributes.popper}>
          <div className={styles.editor} ref={clickAwayRef}>
            <div className={styles.header}>
              <Stack justifyContent={'space-between'} alignItems={'center'}>
                <div className={styles.title}>Set Frame settings</div>
                <IconButton name="times" aria-label="Close" onClick={onDismiss} />
              </Stack>
            </div>
            <div className={styles.fieldsWrapper}>
              {fields.map((field) => {
                const fieldVisibility = !field.config.custom.hideFrom.viz;

                return (
                  <div className={styles.field} key={`${field.refId}:${field.name}`}>
                    <p className={styles.fieldName}>{field.name} : </p>
                    <div className={styles.controls}>
                      <RadioButtonGroup
                        options={placementOptions}
                        value={field.config.custom.axisPlacement}
                        onChange={(placement) => {
                          /**
                           * Check field exist in user frame settings
                           */
                          const existingIndex = fieldSettings.findIndex(
                            (item) => item.refId === field.refId && item.name === field.name
                          );

                          let updatedSettings: FieldSettings[] = [];

                          if (existingIndex >= 0) {
                            /**
                             * Update settings
                             */
                            updatedSettings = fieldSettings.map((item, index) => {
                              return existingIndex === index
                                ? {
                                    ...item,
                                    axisPlacement: placement,
                                  }
                                : item;
                            });
                          } else {
                            /**
                             * Add field to settings
                             */
                            updatedSettings = [
                              ...fieldSettings,
                              {
                                refId: field.refId,
                                name: field.name,
                                axisPlacement: placement,
                                hideFrom: {
                                  viz: field.config.custom.hideFrom.viz,
                                },
                              },
                            ];
                          }

                          /**
                           * Save settings
                           */
                          onSave(updatedSettings);
                        }}
                      />
                      <IconButton
                        className={styles.iconButton}
                        name={fieldVisibility ? 'eye' : 'eye-slash'}
                        aria-label="Set field visibility"
                        onClick={() => {
                          /**
                           * Check field exist in user frame settings
                           */
                          const existingIndex = fieldSettings.findIndex(
                            (item) => item.refId === field.refId && item.name === field.name
                          );

                          let updatedSettings: FieldSettings[] = [];

                          if (existingIndex >= 0) {
                            /**
                             * Update settings
                             */
                            updatedSettings = fieldSettings.map((item, index) => {
                              return existingIndex === index
                                ? {
                                    ...item,
                                    hideFrom: {
                                      viz: !field.config.custom.hideFrom.viz,
                                    },
                                  }
                                : item;
                            });
                          } else {
                            /**
                             * Add field to settings
                             */
                            updatedSettings = [
                              ...fieldSettings,
                              {
                                refId: field.refId,
                                name: field.name,
                                axisPlacement: field.config.custom.axisPlacement,
                                hideFrom: {
                                  viz: !field.config.custom.hideFrom.viz,
                                },
                              },
                            ];
                          }
                          onSave(updatedSettings);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
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
    fieldsWrapper: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      padding: ${theme.spacing(1.5, 1)};
      display: flex;
      flex-direction: column;
    `,
    field: css`
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: ${theme.spacing(1.5, 0)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      justify-content: space-between;
    `,
    fieldName: css`
      padding-right: ${theme.spacing(0.5)};
      margin: 0px;
    `,
    controls: css`
      display: flex;
      align-items: center;
      width: 50%;
      flex-shrink: 0;
    `,
    iconButton: css`
      margin-left: ${theme.spacing(1)};
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
    `,
  };
};

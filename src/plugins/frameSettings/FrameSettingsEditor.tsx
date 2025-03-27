import React, { HTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { usePopper } from 'react-popper';
import { IconButton, Portal, Stack, useStyles2 } from '@grafana/ui';
import { DataFrame, FieldType, GrafanaTheme2 } from '@grafana/data';
import useClickAway from 'react-use/lib/useClickAway';
import { css } from '@emotion/css';
import { FieldSettings } from 'app/types/frameSettings';
import { ColumnDef } from '@tanstack/react-table';
import { FieldsEditableTable } from './components';

/**
 * Constants
 */
const MaxRows = 10;
const RowHeight = 40.5;

/**
 * Timescale Item
 */
export interface FieldSettingItem {
  /**
   * Field name
   *
   * @type {string}
   */
  name: string;

  /**
   * Frame refId
   *
   * @type {string}
   */
  refId?: string;

  /**
   * Visibility
   *
   * @type {boolean}
   */
  visibility: boolean;

  /**
   * Axis Placement
   *
   * @type {string}
   */
  axisPlacement: string;
}

interface FrameSettingsEditorProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (settings: FieldSettings[]) => void;
  onDismiss: () => void;
  fieldSettings: FieldSettings[];
  frames: DataFrame[];
}

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

  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

  /**
   * Editable Table Data
   */
  const [editableTableData, setEditableTableData] = useState<FieldSettingItem[]>([]);

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

  useEffect(() => {
    const formElement = document.querySelector(`.${styles.editor}`);
    if (formElement && fields) {
      setSize({
        width: formElement.clientWidth,
        height: (Math.min(fields.length, MaxRows) + 1) * RowHeight,
      });
    }
  }, [styles.editor, fields]);

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

  /**
   * Transform fields into editableTable Data
   */
  useEffect(() => {
    if (!fields.length) {
      return;
    }

    /**
     * Set Table Data
     */
    setEditableTableData(
      fields.map((field) => {
        return {
          name: field.name,
          refId: field.refId,
          visibility: field.config.custom.hideFrom.viz,
          axisPlacement: field.config.custom.axisPlacement,
        };
      })
    );
  }, [fields]);

  /**
   * Editable Table Columns
   */
  const columns: Array<ColumnDef<FieldSettingItem>> = useMemo(() => {
    return [
      {
        id: 'name',
        accessorKey: 'name',
        header: () => 'Field',
        cell: ({ getValue }) => {
          const value = getValue() as string;
          return value.charAt(0).toUpperCase() + value.slice(1);
        },
        enableResizing: false,
        meta: {
          fieldSettings: fieldSettings,
        },
      },
      {
        id: 'visibility',
        accessorKey: 'visibility',
        header: () => 'Visibility',
        enableResizing: false,
        meta: {
          fieldSettings: fieldSettings,
        },
      },
      {
        id: 'axisPlacement',
        accessorKey: 'axisPlacement',
        header: () => 'Axis Placement',
        enableResizing: false,
        meta: {
          fieldSettings: fieldSettings,
        },
      },
    ];
  }, [fieldSettings]);

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
            <div>
              <div className={styles.table} style={{ width: size.width, maxHeight: size.height }}>
                {!!editableTableData.length && (
                  <FieldsEditableTable
                    data={editableTableData}
                    columns={columns}
                    onUpdateData={(updatedRowIndex, updatedColumnId, value) => {
                      /**
                       * Save settings
                       */
                      onSave(value as FieldSettings[]);
                    }}
                  />
                )}
              </div>
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
    table: css`
      margin-bottom: ${theme.spacing(1)};
      overflow: auto;
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

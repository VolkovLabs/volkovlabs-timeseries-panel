import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import React, { HTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { css, cx } from '@emotion/css';
import { AlertErrorPayload, AlertPayload, AppEvents, DataFrame, getDataFrameRow, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Button, Field, HorizontalGroup, Select, useStyles2 } from '@grafana/ui';
import { EditableTable } from './components';
import { ColumnDef } from '@tanstack/react-table';

/**
 * Constants
 */
const MaxRows = 10;
const RowHeight = 40.5;

/**
 * Timescale Item
 */
export interface TimescaleItem {
  /**
   * Scale
   *
   * @type {string}
   */
  scale: string;

  /**
   * Min
   *
   * @type {number}
   */
  min: number;

  /**
   * Max
   *
   * @type {number}
   */
  max: number;

  /**
   * Description
   *
   * @type {string}
   */
  description: string;
}

interface TimescaleEditorFormProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (data: TimescaleItem[]) => void;
  onDismiss: () => void;
  scales: string[];
  timescalesFrame: DataFrame | null;
}

const getTimescaleData = (data: DataFrame | null, metric: string) => {
  const defaultData = {
    min: 0,
    max: 0,
    scale: metric,
  };

  if (!data) {
    return defaultData;
  }

  const index = data.fields
    .find((field) => field.name === 'metric')
    ?.values.toArray()
    .findIndex((value) => value === metric);

  if (index === undefined || index < 0) {
    return defaultData;
  }

  const row = getDataFrameRow(data, index);

  return {
    min: row[data.fields.findIndex((field) => field.name === 'min')] as number,
    max: row[data.fields.findIndex((field) => field.name === 'max')] as number,
    scale: metric,
  };
};

export const TimescaleEditorForm = React.forwardRef<HTMLDivElement, TimescaleEditorFormProps>(
  ({ onSave, onDismiss, className, scales, timescalesFrame, ...otherProps }, ref) => {
    const styles = useStyles2(getStyles);
    const clickAwayRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<TimescaleItem>({
      min: 0,
      max: 0,
      scale: scales.length ? scales[0] : '',
      description: '',
    });
    const [size, setSize] = useState({
      width: 0,
      height: 0,
    });

    /**
     * Editable Table Data
     */
    const [editableTableData, setEditableTableData] = useState<TimescaleItem[]>([]);

    /**
     * Events
     */
    const appEvents = getAppEvents();

    useClickAway(clickAwayRef, () => {
      onDismiss();
    });

    useEffect(() => {
      const formElement = document.querySelector(`.${styles.editor}`);
      if (formElement && timescalesFrame) {
        setSize({
          width: formElement.clientWidth,
          height: (Math.min(timescalesFrame.length, MaxRows) + 1) * RowHeight,
        });
      }
    }, [ref, styles.editor, timescalesFrame]);

    useEffect(() => {
      if (timescalesFrame) {
        setFormData((previous) => ({
          ...previous,
          ...getTimescaleData(timescalesFrame, previous.scale),
        }));
      }
    }, [timescalesFrame]);

    const onUpdateScales = useCallback(async () => {
      const notifySuccess = (payload: AlertPayload) =>
        appEvents.publish({ type: AppEvents.alertSuccess.name, payload });
      const notifyError = (payload: AlertErrorPayload) =>
        appEvents.publish({ type: AppEvents.alertError.name, payload });

      setIsLoading(true);
      try {
        await onSave(editableTableData.concat(formData));
        notifySuccess(['Scales updated successfully.']);
        locationService.reload();
      } catch (error: any) {
        setIsLoading(false);
        notifyError(['Scales Error', error]);
      }
    }, [appEvents, onSave, editableTableData, formData]);

    /**
     * Transform frame into editableTable Data
     */
    useEffect(() => {
      if (!timescalesFrame) {
        return;
      }

      const metricValues = timescalesFrame.fields.find((field) => field.name === 'metric')?.values?.toArray() || [];
      const minValues = timescalesFrame.fields.find((field) => field.name === 'min')?.values?.toArray() || [];
      const maxValues = timescalesFrame.fields.find((field) => field.name === 'max')?.values?.toArray() || [];

      setEditableTableData(
        metricValues.reduce((acc, value, index) => {
          if (value !== formData.scale) {
            return acc.concat({
              scale: value,
              min: minValues[index],
              max: maxValues[index],
              description: '',
            });
          }
          return acc;
        }, [])
      );
    }, [formData.scale, timescalesFrame]);

    /**
     * Editable Table Columns
     */
    const columns: Array<ColumnDef<TimescaleItem>> = useMemo(() => {
      return [
        {
          id: 'scale',
          accessorKey: 'scale',
          header: () => 'Scale',
          cell: ({ getValue }) => getValue(),
          enableResizing: false,
        },
        {
          id: 'min',
          accessorKey: 'min',
          header: () => 'Minimum',
          enableResizing: false,
        },
        {
          id: 'max',
          accessorKey: 'max',
          header: () => 'Maximum',
          enableResizing: false,
        },
      ];
    }, []);

    const form = (
      <div // Timescale editor
        ref={ref}
        className={cx(styles.editor, className)}
        {...otherProps}
      >
        <div className={styles.header}>
          <HorizontalGroup justify={'space-between'} align={'center'}>
            <div className={styles.title}>Set Custom scales</div>
          </HorizontalGroup>
        </div>
        {editableTableData && (
          <div className={styles.table} style={{ width: size.width, maxHeight: size.height }}>
            <EditableTable
              data={editableTableData}
              columns={columns}
              onUpdateData={(updatedRowIndex, updatedColumnId, value) => {
                setEditableTableData((prev) => {
                  return prev.map((row, rowIndex) => {
                    if (rowIndex !== updatedRowIndex) {
                      return row;
                    }

                    let normalizedValue = value;

                    /**
                     * Convert to number
                     */
                    if (updatedColumnId === 'min' || updatedColumnId === 'max') {
                      const numberValue = Number(value);
                      normalizedValue = Number.isNaN(numberValue) ? 0 : numberValue;
                    }

                    return {
                      ...row,
                      [updatedColumnId]: normalizedValue,
                    };
                  });
                });
              }}
            />
          </div>
        )}
        <hr />
        <div className={styles.editorForm}>
          <Field label={'Scale'}>
            <Select
              value={formData.scale}
              options={scales.map((value: string) => ({ value, label: value }))}
              onChange={(value: any) => {
                setFormData({
                  ...formData,
                  ...getTimescaleData(timescalesFrame, value.value),
                  scale: value.value,
                });
              }}
            />
          </Field>
          <Field label={'Minimum'}>
            <NumberInput
              value={formData.min}
              min={0}
              onChange={(value) => {
                setFormData({
                  ...formData,
                  min: value || 0,
                });
              }}
            />
          </Field>
          <Field label={'Maximum'}>
            <NumberInput
              value={formData.max}
              min={0}
              onChange={(value) => {
                setFormData({
                  ...formData,
                  max: value || 0,
                });
              }}
            />
          </Field>
          <HorizontalGroup justify={'flex-end'}>
            <Button
              size={'sm'}
              variant="secondary"
              onClick={() => {
                setEditableTableData((prev) =>
                  prev.map((scale) => ({
                    ...scale,
                    min: 0,
                    max: 0,
                  }))
                );
                setFormData((prev) => ({
                  ...prev,
                  min: 0,
                  max: 0,
                }));
              }}
              fill="outline"
            >
              Reset
            </Button>
            <Button size={'sm'} variant="secondary" onClick={onDismiss} fill="outline">
              Cancel
            </Button>
            <Button size={'sm'} type={'submit'} disabled={isLoading} onClick={onUpdateScales}>
              {isLoading ? 'Saving' : 'Save'}
            </Button>
          </HorizontalGroup>
        </div>
      </div>
    );

    return (
      <>
        <div className={styles.backdrop} />
        <div ref={clickAwayRef}>{form}</div>
      </>
    );
  }
);

TimescaleEditorForm.displayName = 'TimescaleEditorForm';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    backdrop: css`
      label: backdrop;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      z-index: ${theme.zIndex.navbarFixed};
    `,
    editor: css`
      background: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z3};
      z-index: ${theme.zIndex.dropdown};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.borderRadius()};
      width: 460px;
    `,
    editorForm: css`
      padding: ${theme.spacing(1)};
    `,
    header: css`
      border-bottom: 1px solid ${theme.colors.border.weak};
      padding: ${theme.spacing(1.5, 1)};
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    table: css`
      overflow: auto;
    `,
  };
};

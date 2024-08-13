import React, { HTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { css, cx } from '@emotion/css';
import { AlertErrorPayload, AlertPayload, AppEvents, DataFrame, GrafanaTheme2 } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, HorizontalGroup, IconButton, useStyles2 } from '@grafana/ui';
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

export const TimescaleEditorForm = React.forwardRef<HTMLDivElement, TimescaleEditorFormProps>(
  ({ onSave, onDismiss, className, scales, timescalesFrame, ...otherProps }, ref) => {
    const styles = useStyles2(getStyles);
    const clickAwayRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
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
      if (formElement && scales) {
        setSize({
          width: formElement.clientWidth,
          height: (Math.min(scales.length, MaxRows) + 1) * RowHeight,
        });
      }
    }, [ref, styles.editor, scales]);

    const onUpdateScales = useCallback(async () => {
      const notifySuccess = (payload: AlertPayload) =>
        appEvents.publish({ type: AppEvents.alertSuccess.name, payload });
      const notifyError = (payload: AlertErrorPayload) =>
        appEvents.publish({ type: AppEvents.alertError.name, payload });

      setIsLoading(true);
      try {
        await onSave(editableTableData);
        notifySuccess(['Scales updated successfully.']);
        setIsLoading(false);
      } catch (error: any) {
        setIsLoading(false);
        notifyError(['Scales Error', error]);
      }
    }, [appEvents, onSave, editableTableData]);

    /**
     * Transform frame into editableTable Data
     */
    useEffect(() => {
      if (!timescalesFrame) {
        return;
      }

      /**
       * Scale Values from dataFrame
       */
      const metricValues = timescalesFrame.fields.find((field) => field.name === 'metric')?.values?.toArray() || [];
      const minValues = timescalesFrame.fields.find((field) => field.name === 'min')?.values?.toArray() || [];
      const maxValues = timescalesFrame.fields.find((field) => field.name === 'max')?.values?.toArray() || [];

      /**
       * Scale Values Map
       */
      const scaleValuesMap: Map<string, { min: number; max: number }> = metricValues.reduce((acc, value, index) => {
        acc.set(value, {
          min: minValues[index],
          max: maxValues[index],
        });
        return acc;
      }, new Map());

      /**
       * Set Table Data
       */
      setEditableTableData(
        scales.map((scale) => ({
          scale,
          min: scaleValuesMap.get(scale)?.min ?? 0,
          max: scaleValuesMap.get(scale)?.max ?? 0,
          description: '',
        }))
      );
    }, [timescalesFrame, scales]);

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
            <IconButton name="times" aria-label="Close" onClick={onDismiss} />
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
        <div className={styles.footer}>
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
    footer: css`
      padding: ${theme.spacing(1)};
      border-top: 1px solid ${theme.colors.border.weak};
    `,
  };
};

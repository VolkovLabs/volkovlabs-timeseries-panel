import React, { HTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { Button, IconButton, Portal, Stack, ToolbarButton, ToolbarButtonRow, useStyles2 } from '@grafana/ui';
import { AlertErrorPayload, AlertPayload, AppEvents, DataFrame, GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { getAppEvents } from '@grafana/runtime';
import { ColumnDef } from '@tanstack/react-table';
import { EditableTable } from './components';

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
  min: number | null;

  /**
   * Max
   *
   * @type {number}
   */
  max: number | null;

  /**
   * Description
   *
   * @type {string}
   */
  description: string;

  /**
   * Auto
   *
   * @type {boolean}
   */
  auto: boolean;
}

interface TimescaleEditorProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (data: TimescaleItem[], isGlobal: boolean) => void;
  onDismiss: () => void;
  scales: string[];
  timescalesFrame: DataFrame | null;
  globalTimescalesFrame: DataFrame | null;
}

export const TimescaleEditor: React.FC<TimescaleEditorProps> = ({
  onDismiss,
  onSave,
  scales,
  style,
  timescalesFrame,
  globalTimescalesFrame,
}) => {
  const wrapEditorRef = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);
  /**
   * State
   */
  const [isLoading, setIsLoading] = useState(false);
  const [isGlobalScales, setIsGlobalScales] = useState(false);
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

  /**
   * Editable Table Data
   */
  const [editableTableData, setEditableTableData] = useState<TimescaleItem[]>([]);

  /**
   * Global Editable Table Data
   * Global scales, well eq. "GLOBAL_SCALES"
   */
  const [globalEditableTableData, setGlobalEditableTableData] = useState<TimescaleItem[]>([]);

  /**
   * Events
   */
  const appEvents = getAppEvents();

  useEffect(() => {
    const formElement = document.querySelector(`.${styles.editor}`);
    if (formElement && scales) {
      setSize({
        width: formElement.clientWidth,
        height: (Math.min(scales.length, MaxRows) + 1) * RowHeight,
      });
    }
  }, [styles.editor, scales]);

  const onUpdateScales = useCallback(async () => {
    const notifySuccess = (payload: AlertPayload) => appEvents.publish({ type: AppEvents.alertSuccess.name, payload });
    const notifyError = (payload: AlertErrorPayload) => appEvents.publish({ type: AppEvents.alertError.name, payload });

    setIsLoading(true);
    try {
      await onSave(isGlobalScales ? globalEditableTableData : editableTableData, isGlobalScales);
      notifySuccess(['Scales updated successfully.']);
      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
      notifyError(['Scales Error', error]);
    }
  }, [appEvents, editableTableData, onSave, isGlobalScales, globalEditableTableData]);

  useEffect(() => {
    const processTimescales = (frame: DataFrame | null, setTableData: (data: TimescaleItem[]) => void) => {
      if (!frame) {
        return;
      }

      const metricValues = frame.fields.find((field) => field.name === 'metric')?.values || [];
      const minValues = frame.fields.find((field) => field.name === 'min')?.values || [];
      const maxValues = frame.fields.find((field) => field.name === 'max')?.values || [];

      const scaleValuesMap: Map<string, { min: number; max: number }> = metricValues.reduce((acc, value, index) => {
        acc.set(value, { min: minValues[index], max: maxValues[index] });
        return acc;
      }, new Map());

      setTableData(
        scales.map((scale) => {
          const min = scaleValuesMap.get(scale)?.min;
          const max = scaleValuesMap.get(scale)?.max;
          const auto = min === null || max === null || (!min && !max);

          return {
            scale,
            min: min ?? 0,
            max: max ?? 0,
            description: '',
            auto,
          };
        })
      );
    };

    /**
     * Process Timescales
     * Scales, based on well
     */
    processTimescales(timescalesFrame, setEditableTableData);

    /**
     * Process Timescales
     * Global scales, well eq. "GLOBAL_SCALES"
     */
    processTimescales(globalTimescalesFrame, setGlobalEditableTableData);
  }, [timescalesFrame, globalTimescalesFrame, scales]);

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
        id: 'auto',
        accessorKey: 'auto',
        header: () => 'Auto',
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
          <div className={cx(styles.editor)}>
            <div className={styles.header}>
              <Stack justifyContent={'space-between'} alignItems={'center'}>
                <div className={styles.title}>Set Custom scales</div>
                <IconButton name="times" aria-label="Close" onClick={onDismiss} />
              </Stack>
            </div>
            <ToolbarButtonRow alignment="left">
              <ToolbarButton
                variant={!isGlobalScales ? 'active' : 'default'}
                onClick={() => {
                  setIsGlobalScales(false);
                }}
              >
                Scales
              </ToolbarButton>
              <ToolbarButton
                variant={isGlobalScales ? 'active' : 'default'}
                onClick={() => {
                  setIsGlobalScales(true);
                }}
              >
                Global Scales
              </ToolbarButton>
            </ToolbarButtonRow>
            {!isGlobalScales && editableTableData && (
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
            {isGlobalScales && globalEditableTableData && (
              <div className={styles.table} style={{ width: size.width, maxHeight: size.height }}>
                <EditableTable
                  data={globalEditableTableData}
                  columns={columns}
                  onUpdateData={(updatedRowIndex, updatedColumnId, value) => {
                    setGlobalEditableTableData((prev) => {
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
              <Stack justifyContent={'flex-end'}>
                <Button
                  size={'sm'}
                  variant="secondary"
                  onClick={() => {
                    {
                      isGlobalScales
                        ? setGlobalEditableTableData((prev) =>
                            prev.map((scale) => ({
                              ...scale,
                              auto: true,
                              min: 0,
                              max: 0,
                            }))
                          )
                        : setEditableTableData((prev) =>
                            prev.map((scale) => ({
                              ...scale,
                              auto: true,
                              min: 0,
                              max: 0,
                            }))
                          );
                    }
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
              </Stack>
            </div>
          </div>
        </div>
      </>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    backdrop: css`
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
    table: css`
      overflow: auto;
    `,
    footer: css`
      padding: ${theme.spacing(1)};
      border-top: 1px solid ${theme.colors.border.weak};
    `,
  };
};

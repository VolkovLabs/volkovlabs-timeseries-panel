import React from 'react';
import { AxisPlacement, Checkbox, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cx } from '@emotion/css';
import { Styles } from './FieldsEditableTable.styles';
import { FieldSettingItem } from 'plugins/frameSettings/FrameSettingsEditor';
import { updateFrameSettings } from '../../../../utils';

/**
 * Properties
 */
interface Props<TData> {
  /**
   * Data
   */
  data: TData[];

  /**
   * Columns
   */
  columns: Array<ColumnDef<TData>>;

  /**
   * On Update Data
   */
  onUpdateData: (rowIndex: number, columnId: string, value: unknown) => void;
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

/**
 * Default Column
 */
const defaultColumn: Partial<ColumnDef<any>> = {
  cell: ({ getValue, row, column, table }) => {
    const value = getValue();
    const currentSettings = column.columnDef.meta?.fieldSettings;

    const onSaveValue = (value: unknown) => {
      table.options.meta?.updateData(row.index, column.id, value);
    };

    if (column.id === 'visibility') {
      return (
        <Checkbox
          /**
           * hideFrom.viz: true means hide from visualization
           */
          value={!value as boolean}
          onChange={(e) => {
            if (currentSettings) {
              const updatedSettings = updateFrameSettings(currentSettings, {
                ...row.original,
                visibility: !e.currentTarget.checked,
              } as FieldSettingItem);
              onSaveValue(updatedSettings);
            }
          }}
        />
      );
    }

    return (
      <RadioButtonGroup
        options={placementOptions}
        value={value}
        onChange={(placement) => {
          if (currentSettings) {
            const updatedSettings = updateFrameSettings(currentSettings, {
              ...row.original,
              axisPlacement: placement,
            } as FieldSettingItem);
            onSaveValue(updatedSettings);
          }
        }}
      />
    );
  },
};

/**
 * Fields Editable Table
 */
export const FieldsEditableTable = <TData,>({ data, columns, onUpdateData }: Props<TData>) => {
  /**
   * Styles
   */
  const styles = useStyles2(Styles);

  /**
   * Instance
   */
  const tableInstance = useReactTable<TData>({
    columns,
    data,
    defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex, columnId, value) => {
        onUpdateData(rowIndex, columnId, value);
      },
    },
  });

  return (
    <table className={styles.table}>
      <thead className={styles.header}>
        {tableInstance.getHeaderGroups().map((headerGroup) => {
          return (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <th
                    key={header.id}
                    className={cx(styles.headerCell, {
                      [styles.disableGrow]: !header.column.getCanResize(),
                      [styles.cellCenter]: header.column.id !== 'name',
                    })}
                    colSpan={header.colSpan}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              })}
            </tr>
          );
        })}
      </thead>

      <tbody>
        {tableInstance.getRowModel().rows.map((row) => {
          return (
            <tr key={row.id} className={styles.row}>
              {row.getVisibleCells().map((cell) => {
                return (
                  <td
                    key={cell.id}
                    className={cx({
                      [styles.cellCenter]: cell.column.id !== 'name',
                    })}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

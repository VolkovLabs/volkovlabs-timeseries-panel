import React, { useEffect, useState } from 'react';
import { Checkbox, Input, useStyles2 } from '@grafana/ui';
import { ColumnDef, flexRender, getCoreRowModel, RowData, useReactTable } from '@tanstack/react-table';
import { cx } from '@emotion/css';
import { Styles } from './EditableTable.styles';
import { FieldSettings } from 'app/types/frameSettings';

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

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }

  interface ColumnMeta<TData extends RowData, TValue> {
    fieldSettings?: FieldSettings[];
  }
}

/**
 * Default Column
 */
const defaultColumn: Partial<ColumnDef<any>> = {
  cell: ({ getValue, row: { index, original }, column: { id }, table }) => {
    const initialValue = getValue();
    /**
     *  We need to keep and update the state of the cell normally
     */
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, setValue] = useState(initialValue);

    /**
     * When the input is blurred, we'll call our table meta's updateData function
     */
    const onSaveValue = (value: unknown) => {
      table.options.meta?.updateData(index, id, value);
    };

    /**
     * If the initialValue is changed external, sync it up with our state
     */
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      setValue(initialValue);
    }, [initialValue]);

    if (id === 'auto') {
      return (
        <Checkbox
          value={value as boolean}
          onChange={(e) => {
            setValue(e.currentTarget.checked);
            onSaveValue(e.currentTarget.checked);
          }}
        />
      );
    }

    return (
      <Input
        value={original.auto ? '' : (value as string)}
        placeholder={original ? 'Auto' : ''}
        onChange={(e) => setValue(e.currentTarget.value)}
        onBlur={() => onSaveValue(value)}
        type={typeof initialValue === 'number' ? 'number' : 'text'}
        disabled={original.auto}
      />
    );
  },
};

/**
 * Editable Table
 */
export const EditableTable = <TData,>({ data, columns, onUpdateData }: Props<TData>) => {
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
                      [styles.cellCenter]: cell.column.id === 'auto',
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

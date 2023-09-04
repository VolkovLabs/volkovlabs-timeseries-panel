import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import React, { HTMLAttributes, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { css, cx } from '@emotion/css';
import {
  AlertErrorPayload,
  AlertPayload,
  AppEvents,
  DataFrame,
  Field as FieldItem,
  getDataFrameRow,
  getDisplayProcessor,
  GrafanaTheme2,
} from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
import { Button, Field, HorizontalGroup, Select, Table, useStyles2, useTheme2 } from '@grafana/ui';

/**
 * Constants
 */
const MaxRows = 10;
const RowHeight = 36;

export interface TimescaleEditFormDTO {
  description: string;
  min: number;
  max: number;
  scale: string;
}

interface TimescaleEditorFormProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (data: TimescaleEditFormDTO) => void;
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
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const clickAwayRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<TimescaleEditFormDTO>({
      description: '',
      min: 0,
      max: 0,
      scale: scales.length ? scales[0] : '',
    });
    const [size, setSize] = useState({
      width: 0,
      height: 0,
    });

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

    const onSubmit = useCallback(
      async (data: TimescaleEditFormDTO) => {
        const notifySuccess = (payload: AlertPayload) =>
          appEvents.publish({ type: AppEvents.alertSuccess.name, payload });
        const notifyError = (payload: AlertErrorPayload) =>
          appEvents.publish({ type: AppEvents.alertError.name, payload });

        setIsLoading(true);
        try {
          await onSave(data);
          notifySuccess(['Scales updated successfully.']);
          locationService.reload();
        } catch (error: any) {
          setIsLoading(false);
          notifyError(['Scales Error', error]);
        }
      },
      [onSave, appEvents]
    );

    const tableData = useMemo((): DataFrame | null => {
      if (!timescalesFrame) {
        return null;
      }

      /**
       * Set Display Names
       */
      timescalesFrame.fields.forEach((field) => {
        if (field.name === 'metric') {
          field.config.displayName = 'Scale';
        } else if (field.name === 'min') {
          field.config.displayName = 'Minimum';
        } else if (field.name === 'max') {
          field.config.displayName = 'Maximum';
        }
      });

      const fields = timescalesFrame.fields.map((field) => ({
        ...field,
        display: getDisplayProcessor({
          field,
          theme,
        }),
      }));

      return {
        ...timescalesFrame,
        fields: [
          fields.find((field) => field.name === 'metric'),
          fields.find((field) => field.name === 'min'),
          fields.find((field) => field.name === 'max'),
        ].filter((field) => !!field) as FieldItem[],
      };
    }, [theme, timescalesFrame]);

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
        {tableData && <Table data={tableData} width={size.width} height={size.height} />}
        <hr />
        <div className={styles.editorForm}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(formData);
            }}
          >
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
              <Button size={'sm'} variant="secondary" onClick={onDismiss} fill="outline">
                Cancel
              </Button>
              <Button size={'sm'} type={'submit'} disabled={isLoading}>
                {isLoading ? 'Saving' : 'Save'}
              </Button>
            </HorizontalGroup>
          </form>
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
  };
};

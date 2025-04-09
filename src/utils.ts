import {
  DataFrame,
  DisplayValue,
  Field,
  FieldType,
  getDisplayProcessor,
  getLinksSupplier,
  GrafanaTheme2,
  InterpolateFunction,
  isBooleanUnit,
  TimeRange,
} from '@grafana/data';
import { convertFieldType } from 'app/core/utils/convertFieldType';
import { GraphFieldConfig, LineInterpolation, TooltipDisplayMode, VizTooltipOptions } from '@grafana/schema';
import { applyNullInsertThreshold } from '@grafana/ui/src/components/GraphNG/nullInsertThreshold';
import { nullToValue } from '@grafana/ui/src/components/GraphNG/nullToValue';
import { FieldSettings } from 'app/types/frameSettings';
import { FieldSettingItem } from 'plugins/frameSettings/FrameSettingsEditor';
import { UserSettings } from 'app/types/userSettings';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';

interface PropsOptions {
  series: DataFrame[];
  theme: GrafanaTheme2;
  fieldSettings: FieldSettings[];
  timeRange?: TimeRange;
  // numeric X requires a single frame where the first field is numeric
  xNumFieldIdx?: number;
  userSettings: UserSettings;
}

/**
 * Returns null if there are no graphable fields
 */
export function prepareGraphableFields({
  series,
  theme,
  fieldSettings,
  timeRange,
  xNumFieldIdx,
  userSettings,
}: PropsOptions): DataFrame[] | null {
  if (!series?.length) {
    return null;
  }

  let useNumericX = xNumFieldIdx != null;

  // Make sure the numeric x field is first in the frame
  if (xNumFieldIdx != null && xNumFieldIdx > 0) {
    series = [
      {
        ...series[0],
        fields: [series[0].fields[xNumFieldIdx], ...series[0].fields.filter((f, i) => i !== xNumFieldIdx)],
      },
    ];
  }

  // some datasources simply tag the field as time, but don't convert to milli epochs
  // so we're stuck with doing the parsing here to avoid Moment slowness everywhere later
  // this mutates (once)
  for (let frame of series) {
    for (let field of frame.fields) {
      if (field.type === FieldType.time && typeof field.values[0] !== 'number') {
        field.values = convertFieldType(field, { destinationType: FieldType.time }).values;
      }
    }
  }

  let copy: Field;

  const frames: DataFrame[] = [];

  for (let frame of series) {
    const fields: Field[] = [];

    let hasTimeField = false;
    let hasValueField = false;

    let nulledFrame = useNumericX
      ? frame
      : applyNullInsertThreshold({
          frame,
          refFieldPseudoMin: timeRange?.from.valueOf(),
          refFieldPseudoMax: timeRange?.to.valueOf(),
        });

    const frameFields = nullToValue(nulledFrame).fields;

    for (let fieldIdx = 0; fieldIdx < frameFields?.length ?? 0; fieldIdx++) {
      const field = frameFields[fieldIdx];

      switch (field.type) {
        case FieldType.time:
          hasTimeField = true;
          fields.push(field);
          break;
        case FieldType.number:
          hasValueField = useNumericX ? fieldIdx > 0 : true;
          copy = {
            ...field,
            values: field.values.map((v) => {
              if (!(Number.isFinite(v) || v == null)) {
                return null;
              }
              return v;
            }),
          };

          fields.push(copy);
          break; // ok
        case FieldType.string:
          copy = {
            ...field,
            values: field.values,
          };

          fields.push(copy);
          break; // ok
        case FieldType.boolean:
          hasValueField = true;
          const custom: GraphFieldConfig = field.config?.custom ?? {};
          const config = {
            ...field.config,
            max: 1,
            min: 0,
            custom,
          };

          // smooth and linear do not make sense
          if (custom.lineInterpolation !== LineInterpolation.StepBefore) {
            custom.lineInterpolation = LineInterpolation.StepAfter;
          }

          copy = {
            ...field,
            config,
            type: FieldType.number,
            values: field.values.map((v) => {
              if (v == null) {
                return v;
              }
              return Boolean(v) ? 1 : 0;
            }),
          };

          if (!isBooleanUnit(config.unit)) {
            config.unit = 'bool';
            copy.display = getDisplayProcessor({ field: copy, theme });
          }

          fields.push(copy);
          break;
      }
    }

    if ((useNumericX || hasTimeField) && hasValueField) {
      frames.push({
        ...frame,
        length: nulledFrame.length,
        fields,
      });
    }
  }

  if (frames.length) {
    setClassicPaletteIdxs(frames, theme, 0);
    /**
     * Apply user settings from user storage
     */
    applyUserSettingsForFrame(frames, fieldSettings, userSettings);
    return frames;
  }

  return null;
}

const setClassicPaletteIdxs = (frames: DataFrame[], theme: GrafanaTheme2, skipFieldIdx?: number) => {
  let seriesIndex = 0;
  frames.forEach((frame) => {
    frame.fields.forEach((field, fieldIdx) => {
      // TODO: also add FieldType.enum type here after https://github.com/grafana/grafana/pull/60491
      if (fieldIdx !== skipFieldIdx && (field.type === FieldType.number || field.type === FieldType.boolean)) {
        field.state = {
          ...field.state,
          seriesIndex: seriesIndex++, // TODO: skip this for fields with custom renderers (e.g. Candlestick)?
        };
        field.display = getDisplayProcessor({ field, theme });
      }
    });
  });
};

/**
 * applyUserSettingsForFrame
 */
const applyUserSettingsForFrame = (frames: DataFrame[], fieldSettings: FieldSettings[], userSettings: UserSettings) => {
  frames.forEach((frame) => {
    frame.fields.forEach((field) => {
      const existedField = fieldSettings.find((item) => item.refId === frame.refId && item.name === field.name);
      if (existedField) {
        field.config.custom.axisPlacement = existedField.axisPlacement;
        field.config.custom.hideFrom = {
          ...field.config.custom.hideFrom,
          /**
           * Hide from visualization and legend
           */
          viz: existedField.visibility,
          legend: existedField.visibility,
        };
      }

      if (!!userSettings.scaleDistribution?.type) {
        field.config.custom.scaleDistribution = {
          ...field.config.custom.scaleDistribution,
          ...userSettings.scaleDistribution,
        };
      }
    });
  });
};

export function getTimezones(timezones: string[] | undefined, defaultTimezone: string): string[] {
  if (!timezones || !timezones.length) {
    return [defaultTimezone];
  }
  return timezones.map((v) => (v?.length ? v : defaultTimezone));
}

export function regenerateLinksSupplier(
  alignedDataFrame: DataFrame,
  frames: DataFrame[],
  replaceVariables: InterpolateFunction,
  timeZone: string
): DataFrame {
  alignedDataFrame.fields.forEach((field) => {
    if (field.state?.origin?.frameIndex === undefined || frames[field.state?.origin?.frameIndex] === undefined) {
      return;
    }

    /* check if field has sortedVector values
      if it does, sort all string fields in the original frame by the order array already used for the field
      otherwise just attach the fields to the temporary frame used to get the links
    */
    const tempFields: Field[] = [];
    for (const frameField of frames[field.state?.origin?.frameIndex].fields) {
      if (frameField.type === FieldType.string) {
        tempFields.push(frameField);
      }
    }

    const tempFrame: DataFrame = {
      fields: [...alignedDataFrame.fields, ...tempFields],
      length: alignedDataFrame.fields.length + tempFields.length,
    };

    field.getLinks = getLinksSupplier(tempFrame, field, field.state!.scopedVars!, replaceVariables, timeZone);
  });

  return alignedDataFrame;
}

export const isTooltipScrollable = (tooltipOptions: VizTooltipOptions | any) => {
  return tooltipOptions.mode === TooltipDisplayMode.Multi && tooltipOptions.maxHeight != null;
};

export const updateFrameSettings = (currentSettings: FieldSettings[] | undefined, updatedField: FieldSettingItem) => {
  /**
   * Check field exist in user frame settings
   */
  const existingIndex = currentSettings!.findIndex(
    (item) => item.refId === updatedField.refId && item.name === updatedField.name
  );

  if (existingIndex >= 0) {
    return currentSettings?.map((item, index) => {
      return existingIndex === index ? updatedField : item;
    });
  }

  return [...currentSettings!, updatedField];
};

export const checkScaleLimits = (fieldValues: number[], min?: number | null, max?: number | null) => {
  if (max !== undefined && max !== null) {
    if (fieldValues.every((num) => num > max)) {
      return true;
    }
  }

  if (min !== undefined && min !== null) {
    if (fieldValues.every((num) => num < min)) {
      return true;
    }
  }

  return false;
};

/**
 * Apply display value
 * @param value
 */
export const applyDisplayValue = (value: DisplayValue) => {
  return value.suffix ? `${value.text}${value.suffix}` : value.text;
};

/**
 * Transform data to download
 * @param dataFrames
 */
export const transformDataToDownload = (dataFrames?: DataFrame[]): unknown[][] => {
  if (!dataFrames || !dataFrames.length) {
    return [];
  }

  const fields = dataFrames[0].fields;

  /**
   * Table headers
   */
  const headers = fields.map((field) => field.name);

  const rowCount = Math.max(...fields.map((field) => field.values.length));

  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    fields.map((field) => {
      const value = field.values[rowIndex];
      if (value === undefined) {
        return null;
      }
      return field.display ? applyDisplayValue(field.display(value)) : value;
    })
  );

  return [headers, ...rows];
};

/**
 * Download Xlsx
 * @param content
 * @param fileName
 * @param tableName
 */
export const downloadXlsx = (content: unknown[][], fileName = 'download', tableName?: string) => {
  const ws = utils.aoa_to_sheet(content);
  const wb = utils.book_new();

  /**
   * tableName use for sheet name
   * substring needs here https://support.microsoft.com/en-us/office/rename-a-worksheet-3f1f7148-ee83-404d-8ef0-9ff99fbad1f9
   * Worksheet names cannot: Contain more than 31 characters.
   */
  const sheetName = (tableName ?? 'Sheet1').substring(0, 31);

  utils.book_append_sheet(wb, ws, sheetName);

  const blob = write(wb, { bookType: 'xlsx', type: 'array' });

  const fileData = new Blob([blob], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  return saveAs(fileData, `${fileName}.xlsx`);
};

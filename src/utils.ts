import {
  DataFrame,
  Field,
  FieldConfigSource,
  FieldType,
  getDisplayProcessor,
  getLinksSupplier,
  GrafanaTheme2,
  InterpolateFunction,
  isBooleanUnit,
  SortedVector,
  sortThresholds,
  ThresholdsConfig,
  TimeRange,
} from '@grafana/data';
import { convertFieldType } from 'app/core/utils/convertFieldType';
import { GraphFieldConfig, LineInterpolation } from '@grafana/schema';
import { applyNullInsertThreshold } from '@grafana/ui/src/components/GraphNG/nullInsertThreshold';
import { nullToValue } from '@grafana/ui/src/components/GraphNG/nullToValue';

/**
 * Returns null if there are no graphable fields
 */
export function prepareGraphableFields(
  series: DataFrame[],
  theme: GrafanaTheme2,
  timeRange?: TimeRange,
  // numeric X requires a single frame where the first field is numeric
  xNumFieldIdx?: number,
  fieldConfig?: FieldConfigSource
): DataFrame[] | null {
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

      let thresholds: ThresholdsConfig | undefined = undefined;

      if (field.config.thresholds) {
        thresholds = {
          mode: field.config.thresholds.mode,
          steps: [],
        };

        const fieldOverrides =
          fieldConfig?.overrides.filter((override) => {
            return override.matcher.id === 'byName' && override.matcher.options === field.name;
          }) || [];

        if (fieldOverrides.length >= 2) {
          /**
           * Multiple Overrides
           */
          const allSteps = fieldOverrides.reduce((acc, item) => {
            const thresholdProperty = item.properties.find((property) => property.id === 'thresholds');

            if (thresholdProperty) {
              return acc.concat(thresholdProperty.value.steps);
            }
            return acc;
          }, []);

          thresholds.steps = sortThresholds(allSteps);
        } else {
          thresholds = field.config.thresholds;
        }
      }

      switch (field.type) {
        case FieldType.time:
          hasTimeField = true;
          fields.push(field);
          break;
        case FieldType.number:
          hasValueField = useNumericX ? fieldIdx > 0 : true;
          copy = {
            ...field,
            config: {
              ...field.config,
              thresholds,
            },
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
            config: {
              ...field.config,
              thresholds,
            },
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
            thresholds,
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
        if (field.values instanceof SortedVector) {
          const copiedField = { ...frameField };
          copiedField.values = new SortedVector(frameField.values, field.values.getOrderArray());
          tempFields.push(copiedField);
        } else {
          tempFields.push(frameField);
        }
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

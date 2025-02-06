import { createTheme, FieldType, toDataFrame } from '@grafana/data';

import { checkScaleLimits, prepareGraphableFields } from './utils';

describe('utils', () => {
  describe('prepare timeseries graph', () => {
    it('errors with no time fields', () => {
      const input = [
        toDataFrame({
          fields: [
            { name: 'a', values: [1, 2, 3] },
            { name: 'b', values: ['a', 'b', 'c'] },
          ],
        }),
      ];
      const frames = prepareGraphableFields(input, createTheme());
      expect(frames).toBeNull();
    });

    it('requires a number or boolean value', () => {
      const input = [
        toDataFrame({
          fields: [
            { name: 'a', type: FieldType.time, values: [1, 2, 3] },
            { name: 'b', values: ['a', 'b', 'c'] },
          ],
        }),
      ];
      const frames = prepareGraphableFields(input, createTheme());
      expect(frames).toBeNull();
    });

    it('sets classic palette index on graphable fields', () => {
      const input = [
        toDataFrame({
          fields: [
            { name: 'a', type: FieldType.time, values: [1, 2, 3] },
            { name: 'b', type: FieldType.string, values: ['a', 'b', 'c'] },
            { name: 'c', type: FieldType.number, values: [1, 2, 3] },
            { name: 'd', type: FieldType.string, values: ['d', 'e', 'f'] },
            { name: 'e', type: FieldType.boolean, values: [true, false, true] },
          ],
        }),
      ];
      const frames = prepareGraphableFields(input, createTheme());
      expect(frames![0].fields.map((f) => f.state?.seriesIndex)).toEqual([undefined, undefined, 0, undefined, 1]);
    });

    it('will graph numbers and boolean values', () => {
      const input = [
        toDataFrame({
          fields: [
            { name: 'a', type: FieldType.time, values: [1, 2, 3] },
            { name: 'b', values: ['a', 'b', 'c'] },
            { name: 'c', values: [true, false, true] },
            { name: 'd', values: [100, 200, 300] },
          ],
        }),
      ];
      const frames = prepareGraphableFields(input, createTheme());
      const out = frames![0];

      expect(out.fields.map((f) => f.name)).toEqual(['a', 'b', 'c', 'd']);

      const field = out.fields.find((f) => f.name === 'c');
      expect(field?.display).toBeDefined();
      expect(field!.display!(1)).toMatchInlineSnapshot(`
        {
          "color": "#808080",
          "numeric": 1,
          "percent": 1,
          "prefix": undefined,
          "suffix": undefined,
          "text": "True",
        }
      `);
    });

    it('will convert NaN and Infinty to nulls', () => {
      const df = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [995, 9996, 9997, 9998, 9999] },
          { name: 'a', values: [-10, NaN, 10, -Infinity, +Infinity] },
        ],
      });
      const frames = prepareGraphableFields([df], createTheme());

      const field = frames![0].fields.find((f) => f.name === 'a');
      expect(field!.values).toMatchInlineSnapshot(`
        [
          -10,
          null,
          10,
          null,
          null,
        ]
      `);
    });

    it('will insert nulls given an interval value', () => {
      const df = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 6] },
          { name: 'a', values: [1, 2, 3] },
        ],
      });
      const frames = prepareGraphableFields([df], createTheme());

      const field = frames![0].fields.find((f) => f.name === 'a');
      expect(field!.values).toMatchInlineSnapshot(`
        [
          1,
          null,
          2,
          null,
          null,
          3,
        ]
      `);

      expect(frames![0].length).toEqual(6);
    });

    it('will insert and convert nulls to a configure "no value" value', () => {
      const df = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, config: { interval: 1 }, values: [1, 3, 6] },
          { name: 'a', config: { noValue: '20' }, values: [1, 2, 3] },
        ],
      });
      const frames = prepareGraphableFields([df], createTheme());

      const field = frames![0].fields.find((f) => f.name === 'a');
      expect(field!.values).toMatchInlineSnapshot(`
        [
          1,
          20,
          2,
          20,
          20,
          3,
        ]
      `);
      expect(frames![0].length).toEqual(6);
    });
  });

  describe('checkScaleLimits', () => {
    it('Should return true if all values are greater than max', () => {
      expect(checkScaleLimits([10, 20, 30], null, 5)).toEqual(true);
      expect(checkScaleLimits([5, 6, 7], 0, 4)).toEqual(true);
    });

    it('Should return true if all values are less than min', () => {
      expect(checkScaleLimits([1, 2, 3], 5, null)).toEqual(true);
      expect(checkScaleLimits([-10, -5, -1], 0, 100)).toEqual(true);
    });

    it('Should return false if both min and max are undefined (no limits)', () => {
      expect(checkScaleLimits([10, 20, 30], undefined, undefined)).toEqual(false);
    });

    it('Should return false if the array contains a single value within the range', () => {
      expect(checkScaleLimits([5], 0, 10)).toEqual(false);
    });

    it('Should return true if the array contains a single value outside the limits', () => {
      expect(checkScaleLimits([15], null, 10)).toEqual(true);
      expect(checkScaleLimits([2], 5, null)).toEqual(true);
    });
  });
});

import { nanoid } from '@reduxjs/toolkit';
import { Unsubscribable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import {
  CoreApp,
  DataSourceApi,
  IntervalValues,
  LogsDedupStrategy,
  LogsSortOrder,
  rangeUtil,
  RawTimeRange,
  TimeRange,
} from '@grafana/data';
import { DataQuery, DataSourceRef, TimeZone } from '@grafana/schema';
import { getDataSourceSrv } from '@grafana/runtime';
import { RefreshPicker } from '@grafana/ui';

import { config } from '../config';

import { getNextRefIdChar } from './query';

export const DEFAULT_UI_STATE = {
  dedupStrategy: LogsDedupStrategy.none,
};

export function generateExploreId() {
  return nanoid(3);
}

export const clearQueryKeys: (query: DataQuery) => DataQuery = ({ key, ...rest }) => rest;

export const safeParseJson = (text?: string): any | undefined => {
  if (!text) {
    return;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(error);
  }
};

export const safeStringifyValue = (value: unknown, space?: number) => {
  if (value === undefined || value === null) {
    return '';
  }

  try {
    return JSON.stringify(value, null, space);
  } catch (error) {
    console.error(error);
  }

  return '';
};

export function generateKey(index = 0): string {
  return `Q-${uuidv4()}-${index}`;
}

export async function generateEmptyQuery(
  queries: DataQuery[],
  index = 0,
  dataSourceOverride?: DataSourceRef
): Promise<DataQuery> {
  let datasourceInstance: DataSourceApi | undefined;
  let datasourceRef: DataSourceRef | null | undefined;
  let defaultQuery: Partial<DataQuery> | undefined;

  // datasource override is if we have switched datasources with no carry-over - we want to create a new query with a datasource we define
  // it's also used if there's a root datasource and there were no previous queries
  if (dataSourceOverride) {
    datasourceRef = dataSourceOverride;
  } else if (queries.length > 0 && queries[queries.length - 1].datasource) {
    // otherwise use last queries' datasource
    datasourceRef = queries[queries.length - 1].datasource;
  } else {
    datasourceInstance = await getDataSourceSrv().get();
    defaultQuery = datasourceInstance.getDefaultQuery?.(CoreApp.Explore);
    datasourceRef = datasourceInstance.getRef();
  }

  if (!datasourceInstance) {
    datasourceInstance = await getDataSourceSrv().get(datasourceRef);
    defaultQuery = datasourceInstance.getDefaultQuery?.(CoreApp.Explore);
  }

  return { ...defaultQuery, refId: getNextRefIdChar(queries), key: generateKey(index), datasource: datasourceRef };
}

export const generateNewKeyAndAddRefIdIfMissing = (target: DataQuery, queries: DataQuery[], index = 0): DataQuery => {
  const key = generateKey(index);
  const refId = target.refId || getNextRefIdChar(queries);

  return { ...target, refId, key };
};

/**
 * Ensure at least one target exists and that targets have the necessary keys
 *
 * This will return an empty array if there are no datasources, as Explore is not usable in that state
 */
export async function ensureQueries(
  queries?: DataQuery[],
  newQueryDataSourceOverride?: DataSourceRef
): Promise<DataQuery[]> {
  if (queries && typeof queries === 'object' && queries.length > 0) {
    const allQueries = [];
    for (let index = 0; index < queries.length; index++) {
      const query = queries[index];
      const key = generateKey(index);
      let refId = query.refId;
      if (!refId) {
        refId = getNextRefIdChar(allQueries);
      }

      // if a query has a datasource, validate it and only add it if valid
      // if a query doesn't have a datasource, do not worry about it at this step
      let validDS = true;
      if (query.datasource) {
        try {
          await getDataSourceSrv().get(query.datasource.uid);
        } catch {
          console.error(`One of the queries has a datasource that is no longer available and was removed.`);
          validDS = false;
        }
      }

      if (validDS) {
        allQueries.push({
          ...query,
          refId,
          key,
        });
      }
    }
    return allQueries;
  }
  try {
    // if a datasource override get its ref, otherwise get the default datasource
    const emptyQueryRef = newQueryDataSourceOverride ?? (await getDataSourceSrv().get()).getRef();
    const emptyQuery = await generateEmptyQuery(queries ?? [], undefined, emptyQueryRef);
    return [emptyQuery];
  } catch {
    // if there are no datasources, return an empty array because we will not allow use of explore
    // this will occur on init of explore with no datasources defined
    return [];
  }
}

/**
 * A target is non-empty when it has keys (with non-empty values) other than refId, key, context and datasource.
 * FIXME: While this is reasonable for practical use cases, a query without any propery might still be "non-empty"
 * in its own scope, for instance when there's no user input needed. This might be the case for an hypothetic datasource in
 * which query options are only set in its config and the query object itself, as generated from its query editor it's always "empty"
 */
const validKeys = ['refId', 'key', 'context', 'datasource'];
export function hasNonEmptyQuery<TQuery extends DataQuery>(queries: TQuery[]): boolean {
  return (
    queries &&
    queries.some((query: any) => {
      const keys = Object.keys(query)
        .filter((key) => validKeys.indexOf(key) === -1)
        .map((k) => query[k])
        .filter((v) => v);
      return keys.length > 0;
    })
  );
}

export const getQueryKeys = (queries: DataQuery[]): string[] => {
  const queryKeys = queries.reduce<string[]>((newQueryKeys, query, index) => {
    const primaryKey = query.datasource?.uid || query.key;
    return newQueryKeys.concat(`${primaryKey}-${index}`);
  }, []);

  return queryKeys;
};

export const getTimeRange = (timeZone: TimeZone, rawRange: RawTimeRange, fiscalYearStartMonth: number): TimeRange => {
  let range = rangeUtil.convertRawToRange(rawRange, timeZone, fiscalYearStartMonth);

  if (range.to.isBefore(range.from)) {
    range = rangeUtil.convertRawToRange({ from: range.raw.to, to: range.raw.from }, timeZone, fiscalYearStartMonth);
  }

  return range;
};

export const refreshIntervalToSortOrder = (refreshInterval?: string) =>
  RefreshPicker.isLive(refreshInterval) ? LogsSortOrder.Ascending : LogsSortOrder.Descending;

export const convertToWebSocketUrl = (url: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
  let backend = `${protocol}${window.location.host}${config.appSubUrl}`;
  if (backend.endsWith('/')) {
    backend = backend.slice(0, -1);
  }
  return `${backend}${url}`;
};

export const stopQueryState = (querySubscription: Unsubscribable | undefined) => {
  if (querySubscription) {
    querySubscription.unsubscribe();
  }
};

export function getIntervals(range: TimeRange, lowLimit?: string, resolution?: number): IntervalValues {
  if (!resolution) {
    return { interval: '1s', intervalMs: 1000 };
  }

  return rangeUtil.calculateInterval(range, resolution, lowLimit);
}

export const copyStringToClipboard = (string: string) => {
  const el = document.createElement('textarea');
  el.value = string;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
};

import { uniqBy } from 'lodash';

import { DataLink, Field, LinkModel, ScopedVars } from '@grafana/data';
import { getTemplateSrv, VariableInterpolation } from '@grafana/runtime';

/**
 * This extension of the LinkModel was done to support correlations, which need the variables' names
 * and values split out for display purposes
 *
 * Correlations are internal links only so the variables property will always be defined (but possibly empty)
 * for internal links and undefined for non-internal links
 */
export interface ExploreFieldLinkModel extends LinkModel<Field> {
  variables?: VariableInterpolation[];
}

/**
 * @internal
 */
export function getTitleFromHref(href: string): string {
  // The URL constructor needs the url to have protocol
  if (href.indexOf('://') < 0) {
    // Doesn't really matter what protocol we use.
    href = `http://${href}`;
  }
  let title;
  try {
    const parsedUrl = new URL(href);
    title = parsedUrl.hostname;
  } catch (_e) {
    // Should be good enough fallback, user probably did not input valid url.
    title = href;
  }
  return title;
}

/**
 * Use variable map from templateSrv to determine if all variables have values
 * @param query
 * @param scopedVars
 */
export function getVariableUsageInfo<T extends DataLink>(
  query: T,
  scopedVars: ScopedVars
): { variables: VariableInterpolation[]; allVariablesDefined: boolean } {
  let variables: VariableInterpolation[] = [];
  const replaceFn = getTemplateSrv().replace.bind(getTemplateSrv());
  replaceFn(getStringsFromObject(query), scopedVars, undefined, variables);
  variables = uniqBy(variables, 'variableName');
  return {
    variables: variables,
    allVariablesDefined: variables.every((variable) => variable.found),
  };
}

function getStringsFromObject(obj: Object): string {
  let acc = '';
  let k: keyof typeof obj;

  for (k in obj) {
    if (typeof obj[k] === 'string') {
      acc += ' ' + obj[k];
    } else if (typeof obj[k] === 'object') {
      acc += ' ' + getStringsFromObject(obj[k]);
    }
  }
  return acc;
}

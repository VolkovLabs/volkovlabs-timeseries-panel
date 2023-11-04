import React, { PureComponent } from 'react';

import { AbstractList, ListProps } from './AbstractList';

export class InlineList<T> extends PureComponent<ListProps<T>> {
  render() {
    return <AbstractList inline {...this.props} />;
  }
}

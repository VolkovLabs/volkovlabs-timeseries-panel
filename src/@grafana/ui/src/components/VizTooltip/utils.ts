import { ColorIndicator } from './types';
import { ColorIndicatorStyles } from './VizTooltipColorIndicator';

export const getColorIndicatorClass = (colorIndicator: string, styles: ColorIndicatorStyles) => {
  switch (colorIndicator) {
    case ColorIndicator.value:
      return styles.value;
    case ColorIndicator.hexagon:
      return styles.hexagon;
    case ColorIndicator.pie_1_4:
      return styles.pie_1_4;
    case ColorIndicator.pie_2_4:
      return styles.pie_2_4;
    case ColorIndicator.pie_3_4:
      return styles.pie_3_4;
    case ColorIndicator.marker_sm:
      return styles.marker_sm;
    case ColorIndicator.marker_md:
      return styles.marker_md;
    case ColorIndicator.marker_lg:
      return styles.marker_lg;
    default:
      return styles.value;
  }
};

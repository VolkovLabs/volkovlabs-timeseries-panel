import { AnnotationEvent, PanelData } from '@grafana/data';

export interface AnnotationQueryResponse {
  /**
   * The processed annotation events
   */
  events?: AnnotationEvent[];

  /**
   * The original panel response
   */
  panelData?: PanelData;
}

export interface AnnotationTag {
  /**
   * The tag name
   */
  tag: string;
  /**
   * The number of occurrences of that tag
   */
  count: number;
}

export interface AnnotationTagsResponse {
  result: {
    tags: AnnotationTag[];
  };
}

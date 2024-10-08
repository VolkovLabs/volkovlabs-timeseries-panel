import { Options } from 'panelcfg.gen';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useMountedState } from 'react-use';
import uPlot from 'uplot';
import { CartesianCoords2D, DataFrame } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { getTemplateSrv } from '@grafana/runtime';
import { PlotSelection, UPlotConfigBuilder } from '@grafana/ui';
import { AnnotationEditor } from './annotations/AnnotationEditor';
import { AnnotationsDataFrameViewDTO } from './types';

type StartAnnotatingFn = (props: {
  // pixel coordinates of the clicked point on the uPlot canvas
  coords: { viewport: CartesianCoords2D; plotCanvas: CartesianCoords2D } | null;
}) => void;

const getTagsFromVariables = (variableId: string) => {
  const variables = getTemplateSrv().getVariables();
  return variables.reduce((acc: string[], variable) => {
    if ('options' in variable && variable.id === variableId) {
      const selectedOptions = variable.options.filter((option) => option.selected);
      return acc.concat(...selectedOptions.map((option) => option.text || ''));
    }
    return acc;
  }, []);
};

interface AnnotationEditorPluginProps {
  data: DataFrame;
  timeZone: TimeZone;
  config: UPlotConfigBuilder;
  children?: (props: { startAnnotating: StartAnnotatingFn }) => React.ReactNode;
  options: Options;
}

/**
 * @alpha
 */
export const AnnotationEditorPlugin = ({ data, timeZone, config, children, options }: AnnotationEditorPluginProps) => {
  const plotInstance = useRef<uPlot>();
  const [bbox, setBbox] = useState<DOMRect>();
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [selection, setSelection] = useState<PlotSelection | null>(null);
  const [annotation, setAnnotation] = useState<Pick<AnnotationsDataFrameViewDTO, 'time' | 'timeEnd' | 'tags'>>();
  const isMounted = useMountedState();

  const clearSelection = useCallback(() => {
    setSelection(null);

    if (plotInstance.current) {
      plotInstance.current.setSelect({ top: 0, left: 0, width: 0, height: 0 });
    }
    setIsAddingAnnotation(false);
    setAnnotation(undefined);
  }, [setIsAddingAnnotation, setSelection]);

  useLayoutEffect(() => {
    let annotating = false;

    config.addHook('init', (u) => {
      plotInstance.current = u;
      // Wrap all setSelect hooks to prevent them from firing if user is annotating
      const setSelectHooks = u.hooks.setSelect;

      if (setSelectHooks) {
        for (let i = 0; i < setSelectHooks.length; i++) {
          const hook = setSelectHooks[i];

          if (hook !== setSelect) {
            setSelectHooks[i] = (...args) => {
              !annotating && hook!(...args);
            };
          }
        }
      }
    });

    // cache uPlot plotting area bounding box
    config.addHook('syncRect', (u, rect) => {
      if (!isMounted()) {
        return;
      }
      setBbox(rect);
    });

    const setSelect = (u: uPlot) => {
      if (annotating) {
        setIsAddingAnnotation(true);
        const min = u.posToVal(u.select.left, 'x');
        const max = u.posToVal(u.select.left + u.select.width, 'x');

        setSelection({
          min,
          max,
          bbox: {
            left: u.select.left,
            top: 0,
            height: u.select.height,
            width: u.select.width,
          },
        });

        setAnnotation({
          time: min,
          timeEnd: max,
          tags: getTagsFromVariables(options.variable),
        });
        annotating = false;
      }
    };

    config.addHook('setSelect', setSelect);

    config.setCursor({
      bind: {
        mousedown: (u, targ, handler) => (e) => {
          annotating = e.button === 0 && (e.metaKey || e.ctrlKey);
          handler(e);
          return null;
        },
        mouseup: (u, targ, handler) => (e) => {
          // uPlot will not fire setSelect hooks for 0-width && 0-height selections
          // so we force it to fire on single-point clicks by mutating left & height
          if (annotating && u.select.width === 0) {
            u.select.left = u.cursor.left!;
            u.select.height = u.bbox.height / window.devicePixelRatio;
          }
          handler(e);
          return null;
        },
      },
    });
  }, [config, setBbox, isMounted, options.variable]);

  const startAnnotating = useCallback<StartAnnotatingFn>(
    ({ coords }) => {
      if (!plotInstance.current || !bbox || !coords) {
        return;
      }

      const min = plotInstance.current.posToVal(coords.plotCanvas.x, 'x');

      if (!min) {
        return;
      }

      setSelection({
        min,
        max: min,
        bbox: {
          left: coords.plotCanvas.x,
          top: 0,
          height: bbox.height,
          width: 0,
        },
      });

      setAnnotation({
        time: min,
        timeEnd: min,
        tags: getTagsFromVariables(options.variable),
      });
      setIsAddingAnnotation(true);
    },
    [bbox, options.variable]
  );

  return (
    <>
      {isAddingAnnotation && selection && bbox && (
        <AnnotationEditor
          annotation={annotation as AnnotationsDataFrameViewDTO}
          selection={selection}
          onDismiss={clearSelection}
          onSave={clearSelection}
          data={data}
          timeZone={timeZone}
          style={{
            position: 'absolute',
            top: `${bbox.top}px`,
            left: `${bbox.left}px`,
            width: `${bbox.width}px`,
            height: `${bbox.height}px`,
          }}
        />
      )}
      {children ? children({ startAnnotating }) : null}
    </>
  );
};

import React, { HTMLAttributes, useState } from 'react';
import { usePopper } from 'react-popper';
import { Portal } from '@grafana/ui';
import { DataFrame } from '@grafana/data';
import { TimescaleEditorForm, TimescaleItem } from './TimescaleEditorForm';

interface TimescaleEditorProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (data: TimescaleItem[], isGlobal: boolean) => void;
  onDismiss: () => void;
  scales: string[];
  timescalesFrame: DataFrame | null;
  globalTimescalesFrame: DataFrame | null;
}

export const TimescaleEditor: React.FC<TimescaleEditorProps> = ({
  onDismiss,
  onSave,
  scales,
  style,
  timescalesFrame,
  globalTimescalesFrame,
}) => {
  const [popperTrigger, setPopperTrigger] = useState<HTMLDivElement | null>(null);
  const [editorPopover, setEditorPopover] = useState<HTMLDivElement | null>(null);

  const popper = usePopper(popperTrigger, editorPopover, {
    modifiers: [
      { name: 'arrow', enabled: false },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          rootBoundary: 'viewport',
        },
      },
    ],
  });

  return (
    <Portal>
      <>
        <div ref={setPopperTrigger} style={style} />
        <TimescaleEditorForm
          onSave={onSave}
          onDismiss={onDismiss}
          scales={scales}
          ref={setEditorPopover}
          style={popper.styles.popper}
          timescalesFrame={timescalesFrame}
          globalTimescalesFrame={globalTimescalesFrame}
          {...popper.attributes.popper}
        />
      </>
    </Portal>
  );
};

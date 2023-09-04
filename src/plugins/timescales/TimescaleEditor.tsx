import React, { HTMLAttributes, useState } from 'react';
import { usePopper } from 'react-popper';
import { Portal } from '@grafana/ui';
import { TimescaleEditFormDTO, TimescaleEditorForm } from './TimescaleEditorForm';

interface TimescaleEditorProps extends HTMLAttributes<HTMLDivElement> {
  onSave: (data: TimescaleEditFormDTO) => void;
  onDismiss: () => void;
  scales: string[];
}

export const TimescaleEditor: React.FC<TimescaleEditorProps> = ({ onDismiss, onSave, scales, style }) => {
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
          {...popper.attributes.popper}
        />
      </>
    </Portal>
  );
};

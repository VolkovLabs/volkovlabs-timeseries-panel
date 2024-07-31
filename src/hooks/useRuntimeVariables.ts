import { useCallback, useEffect, useState } from 'react';
import { EventBus, TypedVariableModel } from '@grafana/data';
import { getTemplateSrv, RefreshEvent } from '@grafana/runtime';

/**
 * Runtime Variables
 * @param eventBus
 * @param variableName
 */
export const useRuntimeVariables = (eventBus: EventBus, variableName: string) => {
  const [variables, setVariables] = useState<TypedVariableModel[]>([]);
  const [variable, setVariable] = useState<TypedVariableModel>();

  useEffect(() => {
    setVariables(getTemplateSrv().getVariables());

    /**
     * Update variable on Refresh
     */
    const subscriber = eventBus.getStream(RefreshEvent).subscribe(() => {
      setVariables(getTemplateSrv().getVariables());
    });

    return () => {
      subscriber.unsubscribe();
    };
  }, [eventBus]);

  const getVariable = useCallback(
    (variableName: string) => {
      return variables.find((variable) => variable.name === variableName);
    },
    [variables]
  );

  useEffect(() => {
    setVariable(getVariable(variableName));
  }, [getVariable, variableName]);

  return {
    variable,
    getVariable,
  };
};

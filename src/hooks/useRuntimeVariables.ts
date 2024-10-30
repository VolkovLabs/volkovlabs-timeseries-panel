import { EventBus, TypedVariableModel } from '@grafana/data';
import { useDashboardVariables } from '@volkovlabs/components';

/**
 * Runtime Variables
 * @param eventBus
 * @param variableName
 */
export const useRuntimeVariables = (eventBus: EventBus, variableName: string) => {
  return useDashboardVariables<TypedVariableModel>({
    variableName,
    toState: (variables) => variables,
    getOne: (variables, variableName) => variables.find((variable) => variable.name === variableName),
    initial: [],
    eventBus,
  });
};

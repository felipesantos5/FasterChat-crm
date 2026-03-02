import { createContext, useContext } from 'react';

export const FlowIdContext = createContext<string>('');

export function useFlowId() {
  return useContext(FlowIdContext);
}

import { useId } from 'react';

/** A unique, url()-safe id for a <pattern> inside one chart. */
export function usePatternId(prefix = 'stripes') {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

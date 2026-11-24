import type { FormState } from './state';

export const installUnsavedGuard = (state: FormState, target: Window = window): (() => void) => {
  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!state.isDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  target.addEventListener('beforeunload', onBeforeUnload);
  return () => target.removeEventListener('beforeunload', onBeforeUnload);
};

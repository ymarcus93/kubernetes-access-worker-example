import { AsyncLocalStorage } from "node:async_hooks";

/* eslint-disable @typescript-eslint/no-empty-object-type */
type CustomContext = {
  // Add custom fields that you want access to in request scope
};
/* eslint-enable @typescript-eslint/no-empty-object-type */

export type WorkerContext = Env & CustomContext;

export const contextStorage = new AsyncLocalStorage<WorkerContext>();

export function getContext(): WorkerContext {
  const store = contextStorage.getStore();
  if (!store)
    throw new Error(
      "Context not found! strictly call this within the run scope.",
    );
  return store;
}

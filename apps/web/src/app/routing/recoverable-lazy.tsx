import {
  type Attributes,
  createElement,
  type FunctionComponent,
  lazy,
  type PropsWithRef,
} from "react";

/** React.lazy caches rejected promises. A deliberate retry needs a new instance. */
export function recoverableLazy<P extends object>(
  load: () => Promise<{ default: FunctionComponent<P> }>,
) {
  let Loaded = lazy(load);
  return {
    Component: (props: Attributes & PropsWithRef<P>) =>
      createElement(Loaded, props),
    retry: () => {
      Loaded = lazy(load);
    },
  };
}

import * as React from 'react';
import {
  BaseNavigationContainer,
  NavigationContainerProps,
  NavigationContainerRef,
  InitialState,
  getStateFromPath,
  getActionFromState,
} from '@react-navigation/core';
import ThemeProvider from './theming/ThemeProvider';
import DefaultTheme from './theming/DefaultTheme';
import LinkingContext from './LinkingContext';
import useLinking from './useLinking';
import useBackButton from './useBackButton';
import { Theme, LinkingOptions } from './types';

type Props = NavigationContainerProps & {
  theme?: Theme;
  linking?: LinkingOptions;
  fallback?: React.ReactNode;
};

/**
 * Container component which holds the navigation state designed for React Native apps.
 * This should be rendered at the root wrapping the whole app.
 *
 * @param props.initialState Initial state object for the navigation tree. When deep link handling is enabled, this will be ignored if there's an incoming link.
 * @param props.onStateChange Callback which is called with the latest navigation state when it changes.
 * @param props.theme Theme object for the navigators.
 * @param props.linking Options for deep linking. Deep link handling is enabled when this prop is provided, unless `linking.enabled` is `false`.
 * @param props.fallback Fallback component to render until we have finished getting initial state when linking is enabled. Defaults to `null`.
 * @param props.children Child elements to render the content.
 * @param props.ref Ref object which refers to the navigation object containing helper methods.
 */
const NavigationContainer = React.forwardRef(function NavigationContainer(
  { theme = DefaultTheme, linking, fallback = null, ...rest }: Props,
  ref?: React.Ref<NavigationContainerRef | null>
) {
  const isLinkingEnabled = linking ? linking.enabled !== false : false;

  const [isReady, setIsReady] = React.useState(isLinkingEnabled ? false : true);
  const [initialState, setInitialState] = React.useState<
    InitialState | undefined
  >(isLinkingEnabled ? undefined : rest.initialState);

  const refContainer = React.useRef<NavigationContainerRef>(null);

  useBackButton(refContainer);

  const { getInitialState } = useLinking(refContainer, {
    enabled: isLinkingEnabled,
    prefixes: [],
    ...linking,
  });

  React.useImperativeHandle(ref, () => refContainer.current);

  React.useEffect(() => {
    Promise.race([
      getInitialState(),
      new Promise((resolve) =>
        // Timeout in 150ms if `getInitialState` doesn't resolve
        // Workaround for https://github.com/facebook/react-native/issues/25675
        setTimeout(resolve, 150)
      ),
    ])
      .catch((e) => {
        console.error(e);
      })
      .then((state) => {
        if (state !== undefined) {
          setInitialState(state as InitialState);
        }

        setIsReady(true);
      });
  }, [getInitialState]);

  const linkingOptionsRef = React.useRef(linking);

  React.useEffect(() => {
    linkingOptionsRef.current = linking;
  });

  const linkingContext = React.useMemo(
    () => ({
      linkTo: (path: string) => {
        const state = linkingOptionsRef.current?.getStateFromPath
          ? linkingOptionsRef.current.getStateFromPath(
              path,
              linkingOptionsRef.current.config
            )
          : getStateFromPath(path, linkingOptionsRef.current?.config);

        if (state) {
          const action = getActionFromState(state);

          const navigation = refContainer.current;

          if (action !== undefined) {
            navigation?.dispatch(action);
          } else {
            navigation?.resetRoot(state);
          }
        }
      },
    }),
    [linkingOptionsRef]
  );

  if (!isReady) {
    // This is temporary until we have Suspense for data-fetching
    // Then the fallback will be handled by a parent `Suspense` component
    return fallback as React.ReactElement;
  }

  return (
    <LinkingContext.Provider value={linkingContext}>
      <ThemeProvider value={theme}>
        <BaseNavigationContainer
          {...rest}
          initialState={initialState}
          ref={refContainer}
        />
      </ThemeProvider>
    </LinkingContext.Provider>
  );
});

export default NavigationContainer;

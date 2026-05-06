// Polyfill crypto.randomUUID for React Native before any other imports
import { polyfillCrypto } from "./src/polyfills/crypto";
polyfillCrypto();

// Polyfill screen.orientation for WebKitGTK desktop runtimes that lack the API.
import { polyfillScreenOrientation } from "./src/polyfills/screen-orientation";
polyfillScreenOrientation();

// Configure Unistyles before Expo Router pulls in any components using StyleSheet.
import "./src/styles/unistyles";
import { consumeWebOriginResetRequest } from "./src/utils/web-origin-reset";

const didConsumeWebOriginResetRequest = consumeWebOriginResetRequest(
  typeof window === "undefined" ? undefined : window,
);

if (!didConsumeWebOriginResetRequest) {
  require("expo-router/entry");
}

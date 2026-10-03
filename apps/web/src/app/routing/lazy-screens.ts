import { recoverableLazy } from "./recoverable-lazy";

const alertsScreen = recoverableLazy(async () => ({
  default: (await import("../components/screens/AlertsScreen")).AlertsScreen,
}));
const signInScreen = recoverableLazy(async () => ({
  default: (await import("../components/auth/SignInScreen")).SignInScreen,
}));
const createAccountScreen = recoverableLazy(async () => ({
  default: (await import("../components/auth/CreateAccountScreen"))
    .CreateAccountScreen,
}));
const onboarding1 = recoverableLazy(async () => ({
  default: (await import("../components/auth/OnboardingStep1")).OnboardingStep1,
}));
const settingsScreen = recoverableLazy(async () => ({
  default: (await import("../components/screens/SettingsScreen"))
    .SettingsScreen,
}));
const incubatorsScreen = recoverableLazy(async () => ({
  default: (await import("../components/screens/IncubatorsScreen"))
    .IncubatorsScreen,
}));

const detailScreen = recoverableLazy(async () => ({
  default: (await import("../components/screens/DetailScreen")).DetailScreen,
}));
const trendsScreen = recoverableLazy(async () => ({
  default: (await import("../components/screens/TrendsScreen")).TrendsScreen,
}));
const candlingScreen = recoverableLazy(async () => ({
  default: (await import("../components/screens/CandlingLogsScreen"))
    .CandlingLogsScreen,
}));
const onboarding2 = recoverableLazy(async () => ({
  default: (await import("../components/auth/OnboardingStep2")).OnboardingStep2,
}));
const onboarding3 = recoverableLazy(async () => ({
  default: (await import("../components/auth/OnboardingStep3")).OnboardingStep3,
}));

export const DetailScreen = detailScreen.Component;
export const AlertsScreen = alertsScreen.Component;
export const SignInScreen = signInScreen.Component;
export const CreateAccountScreen = createAccountScreen.Component;
export const OnboardingStep1 = onboarding1.Component;
export const SettingsScreen = settingsScreen.Component;
export const IncubatorsScreen = incubatorsScreen.Component;
export const TrendsScreen = trendsScreen.Component;
export const CandlingLogsScreen = candlingScreen.Component;
export const OnboardingStep2 = onboarding2.Component;
export const OnboardingStep3 = onboarding3.Component;
export function retryLazyScreens() {
  [
    alertsScreen,
    signInScreen,
    createAccountScreen,
    onboarding1,
    detailScreen,
    settingsScreen,
    incubatorsScreen,
    trendsScreen,
    candlingScreen,
    onboarding2,
    onboarding3,
  ].forEach((screen) => {
    screen.retry();
  });
}

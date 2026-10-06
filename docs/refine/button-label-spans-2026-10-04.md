# Button label span review — 2026-10-04

Implementation follow-up: all 74 identified buttons now wrap labels in spans.
Icons remain siblings; existing responsive spans are preserved and loading
branches also wrap text. The shared Button implementation and icon-only buttons
are unchanged. A follow-up JSX scan found zero remaining matches. The table
below records the original review locations before edits.

Validation: frontend typecheck and lint passed; all 336 tests in 46 files passed
with two workers. Browser checks at 402px and 1164px passed on Overview,
Notifications, Incubators, Settings and Trends without horizontal overflow.

Read-only review of native `button` and shared `Button` JSX in `apps/web/src/app`. Found 74 buttons across 26 files with direct text, dynamic labels, or a text branch outside a span. Icon-only conditionals and component children forwarding are excluded. Counts are source buttons, not rendered instances.

This is a consistency finding, not invalid HTML or an accessibility defect by itself. A span makes label-specific wrapping/truncation and flex spacing easier to control. Existing label spans must keep responsive classes; icons should remain separate. The shared Button forwards children without wrapping labels. No application code was changed by this review.

Conditional labels count when at least one branch has unwrapped text (for example Marking… while the normal Mark All label is already wrapped).

| Source | Unwrapped label / expression |
|---|---|
| [apps/web/src/app/App.tsx:273](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/App.tsx:273) | Try again |
| [apps/web/src/app/App.tsx:305](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/App.tsx:305) | Reload data |
| [apps/web/src/app/App.tsx:333](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/App.tsx:333) | Add your first incubator |
| [apps/web/src/app/App.tsx:336](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/App.tsx:336) | Sign out |
| [apps/web/src/app/components/FarmDataStatus.tsx:81](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/FarmDataStatus.tsx:81) | Retry |
| [apps/web/src/app/components/FeatureDataStatus.tsx:37](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/FeatureDataStatus.tsx:37) | Retry |
| [apps/web/src/app/components/HarvestModal.tsx:241](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/HarvestModal.tsx:241) | Cancel |
| [apps/web/src/app/components/HarvestModal.tsx:253](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/HarvestModal.tsx:253) | {isSaving ? "Saving…" : "Save & Reset"} |
| [apps/web/src/app/components/IncubatorCard.tsx:631](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/IncubatorCard.tsx:631) | Finish Cycle |
| [apps/web/src/app/components/IncubatorCard.tsx:651](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/IncubatorCard.tsx:651) | {ready ? "Start Setup" : cta} |
| [apps/web/src/app/components/RawReadingsDialog.tsx:96](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/RawReadingsDialog.tsx:96) | {exporting ? "Preparing complete CSV…" : "Export complete CSV"} |
| [apps/web/src/app/components/RawReadingsDialog.tsx:108](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/RawReadingsDialog.tsx:108) | Retry raw readings |
| [apps/web/src/app/components/RecoveryBoundary.tsx:45](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/RecoveryBoundary.tsx:45) | Try again |
| [apps/web/src/app/components/RecoveryBoundary.tsx:59](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/RecoveryBoundary.tsx:59) | Reload page |
| [apps/web/src/app/components/alerts/NotificationPopover.tsx:115](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/alerts/NotificationPopover.tsx:115) | {markingAllRead ? "Marking…" : "Mark all as read"} |
| [apps/web/src/app/components/alerts/NotificationPopover.tsx:256](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/alerts/NotificationPopover.tsx:256) | View All Notifications |
| [apps/web/src/app/components/auth/CreateAccountScreen.tsx:77](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/CreateAccountScreen.tsx:77) | Return to sign in |
| [apps/web/src/app/components/auth/CreateAccountScreen.tsx:209](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/CreateAccountScreen.tsx:209) | {busy ? "Creating account…" : "Create account"} |
| [apps/web/src/app/components/auth/CreateAccountScreen.tsx:217](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/CreateAccountScreen.tsx:217) | I already have an account |
| [apps/web/src/app/components/auth/OnboardingStep1.tsx:95](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/OnboardingStep1.tsx:95) | Continue → |
| [apps/web/src/app/components/auth/OnboardingStep2.tsx:197](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/OnboardingStep2.tsx:197) | ← Back |
| [apps/web/src/app/components/auth/OnboardingStep2.tsx:208](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/OnboardingStep2.tsx:208) | Continue → |
| [apps/web/src/app/components/auth/OnboardingStep3.tsx:190](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/OnboardingStep3.tsx:190) | ← Back |
| [apps/web/src/app/components/auth/OnboardingStep3.tsx:202](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/OnboardingStep3.tsx:202) | {isSubmitting ? ( "Preparing dashboard…" ) : ( <> <span className="md:hidden">Enter ✓</span> <span className="hidden md:inline">Enter dashboard ✓</span> </> )} |
| [apps/web/src/app/components/auth/SignInScreen.tsx:145](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/SignInScreen.tsx:145) | Password recovery coming soon |
| [apps/web/src/app/components/auth/SignInScreen.tsx:159](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/SignInScreen.tsx:159) | {busy ? "Signing in…" : "Sign in →"} |
| [apps/web/src/app/components/auth/SignInScreen.tsx:182](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/SignInScreen.tsx:182) | {onSetupLabel} |
| [apps/web/src/app/components/auth/StepperBar.tsx:23](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/auth/StepperBar.tsx:23) | I have an account |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:282](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:282) | Cancel |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:294](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:294) | {isSavingNote ? "Saving…" : "Save note"} |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:1224](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:1224) | Count remaining as uncertain |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:1482](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:1482) | {stage === 1 ? ( "Cancel" ) : ( <> <ArrowLeft size={15} /> Back </> )} |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:1500](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:1500) | Next |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:1513](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:1513) | {isSaving ? "Saving…" : isEditing ? "Update Inspection" : "Save Inspection"} |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:2231](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:2231) | Log |
| [apps/web/src/app/components/detail/CandlingJournalTab.tsx:2331](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/CandlingJournalTab.tsx:2331) | Log |
| [apps/web/src/app/components/detail/DeviceSettingsTab.tsx:387](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/DeviceSettingsTab.tsx:387) | Edit preset for future cycles |
| [apps/web/src/app/components/detail/DeviceSettingsTab.tsx:557](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/DeviceSettingsTab.tsx:557) | {isRequestingTurn ? "Requesting…" : turnInProgress ? "Waiting…" : "Turn Now"} |
| [apps/web/src/app/components/detail/DeviceSettingsTab.tsx:711](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/DeviceSettingsTab.tsx:711) | Stop Cycle |
| [apps/web/src/app/components/detail/LiveMonitorTab.tsx:233](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/LiveMonitorTab.tsx:233) | Retry |
| [apps/web/src/app/components/detail/LiveMonitorTab.tsx:307](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/LiveMonitorTab.tsx:307) | Full trends |
| [apps/web/src/app/components/detail/LiveMonitorTab.tsx:332](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/detail/LiveMonitorTab.tsx:332) | Retry |
| [apps/web/src/app/components/incubators/ChamberList.tsx:80](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/incubators/ChamberList.tsx:80) | Clear filters |
| [apps/web/src/app/components/incubators/ChamberList.tsx:307](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/incubators/ChamberList.tsx:307) | Configure |
| [apps/web/src/app/components/incubators/CreateIncubatorDialog.tsx:174](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/incubators/CreateIncubatorDialog.tsx:174) | Cancel |
| [apps/web/src/app/components/incubators/CreateIncubatorDialog.tsx:186](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/incubators/CreateIncubatorDialog.tsx:186) | {connecting \|\| isAddingIncubator ? ( <> <Loader2 size={16} className="animate-spin" /> Connecting to Incubator... </> ) : connectError ? ( "Retry Connection" ) : ( "Connect Incubator" )} |
| [apps/web/src/app/components/screens/AlertsScreen.tsx:205](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/AlertsScreen.tsx:205) | {markingAllRead ? ( "Marking…" ) : ( <> <span className="hidden md:inline">Mark All as Read</span> <span className="md:hidden">Mark All</span> </> )} |
| [apps/web/src/app/components/screens/AlertsScreen.tsx:228](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/AlertsScreen.tsx:228) | {clearingRead ? "Clearing…" : "Clear All"} |
| [apps/web/src/app/components/screens/AlertsScreen.tsx:391](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/AlertsScreen.tsx:391) | {a.unit} |
| [apps/web/src/app/components/screens/CandlingLogsScreen.tsx:339](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/CandlingLogsScreen.tsx:339) | Open log |
| [apps/web/src/app/components/screens/CandlingLogsScreen.tsx:664](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/CandlingLogsScreen.tsx:664) | Clear filters |
| [apps/web/src/app/components/screens/CandlingLogsScreen.tsx:937](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/CandlingLogsScreen.tsx:937) | Open log |
| [apps/web/src/app/components/screens/DetailScreen.tsx:294](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/DetailScreen.tsx:294) | Set Up |
| [apps/web/src/app/components/screens/DetailScreen.tsx:567](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/DetailScreen.tsx:567) | Cancel |
| [apps/web/src/app/components/screens/DetailScreen.tsx:576](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/DetailScreen.tsx:576) | {isUpdating ? "Starting…" : "Start Incubation Cycle"} |
| [apps/web/src/app/components/screens/DetailScreen.tsx:683](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/DetailScreen.tsx:683) | {isUpdating ? "Resetting…" : "Reset to Ready"} |
| [apps/web/src/app/components/screens/DetailScreen.tsx:773](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/DetailScreen.tsx:773) | Finish Cycle |
| [apps/web/src/app/components/screens/SettingsScreen.tsx:227](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/SettingsScreen.tsx:227) | Discard |
| [apps/web/src/app/components/screens/SettingsScreen.tsx:235](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/screens/SettingsScreen.tsx:235) | {isSaving ? "Saving…" : "Save Changes"} |
| [apps/web/src/app/components/settings/HardwarePanel.tsx:361](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/HardwarePanel.tsx:361) | Unavailable |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:572](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:572) | Import |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:580](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:580) | Export All |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:588](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:588) | Add Custom Mode |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:876](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:876) | Cancel |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:884](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:884) | {isMutating ? "Deleting…" : "Delete"} |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:967](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:967) | Cancel |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:975](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:975) | {isMutating ? "Saving…" : "Save"} |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:1044](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:1044) | {r === "overwrite" ? "Overwrite existing" : "Keep both (rename)"} |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:1080](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:1080) | Cancel |
| [apps/web/src/app/components/settings/ModeLibraryPanel.tsx:1088](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/settings/ModeLibraryPanel.tsx:1088) | {isMutating ? "Importing…" : "Import"} |
| [apps/web/src/app/components/trends/EnvironmentalTrends.tsx:137](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/trends/EnvironmentalTrends.tsx:137) | {compareIds.length} \| of \| {units.length} \| Chambers |
| [apps/web/src/app/components/trends/EnvironmentalTrends.tsx:229](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/trends/EnvironmentalTrends.tsx:229) | {compare ? "Readings for compared chambers" : "See all readings"} |
| [apps/web/src/app/components/trends/EnvironmentalTrends.tsx:280](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/trends/EnvironmentalTrends.tsx:280) | Retry |
| [apps/web/src/app/components/trends/EnvironmentalTrends.tsx:373](/home/mawi/Projects/eggcelerate/eggcelerate/apps/web/src/app/components/trends/EnvironmentalTrends.tsx:373) | {u.name} |

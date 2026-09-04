import { z } from "zod";
import { ACCOUNT_HOLDER_MAX, CHAMBER_NAME_MAX, FARM_NAME_MAX } from "./account";

export type PrimaryFocus = "commercial" | "heritage" | "backyard" | "research";

export const PrimaryFocusSchema = z.enum([
  "commercial",
  "heritage",
  "backyard",
  "research",
]);

export const SpeciesSchema = z.enum([
  "chicken",
  "duck",
  "quail",
  "turkey",
  "goose",
  "guinea_fowl",
]);

export interface OnboardingState {
  name: string;
  farmName: string;
  location: string;
  primaryFocus: PrimaryFocus;
  species: string[];
  chamberName: string;
  startingModeId: string;
}

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional().default(false),
});

export const OnboardingStep1Schema = z.object({
  name: z.string().min(1).max(ACCOUNT_HOLDER_MAX).trim(),
  farmName: z.string().min(1).max(FARM_NAME_MAX).trim(),
  location: z.string().max(60).trim().optional().default(""),
});

export const OnboardingStep2Schema = z.object({
  primaryFocus: PrimaryFocusSchema,
  species: z.array(SpeciesSchema).min(1),
});

export const OnboardingStep3Schema = z.object({
  chamberName: z.string().min(1).max(CHAMBER_NAME_MAX).trim(),
  startingModeId: z.string().min(1),
});

export const defaultOnboarding: OnboardingState = {
  name: "",
  farmName: "",
  location: "",
  primaryFocus: "commercial",
  species: ["chicken"],
  chamberName: "Incubator One",
  startingModeId: "broiler",
};

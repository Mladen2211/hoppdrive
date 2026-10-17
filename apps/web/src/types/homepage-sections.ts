/**
 * Content shapes for each CMS-editable homepage section (HomepageSection.content
 * JSON blob). Centralized here since the per-section interfaces were previously
 * scattered one-per-component with no single place to see the whole schema.
 */

export interface HeroContent {
  badgeText?: string;
  heading?: string;
  headingHighlight?: string;
  description?: string;
  ctaPrimaryText?: string;
  ctaPrimaryLink?: string;
  ctaSecondaryText?: string;
  ctaSecondaryLink?: string;
  backgroundImageUrl?: string;
  trustItems?: string[];
}

export interface WhyHoppDriveContent {
  label?: string;
  heading?: string;
  description?: string;
  items?: { title: string; description: string }[];
}

export interface HowItWorksContent {
  label?: string;
  heading?: string;
  description?: string;
  steps?: { number?: string; title: string; description: string; time?: string }[];
}

export interface FleetContent {
  label?: string;
  heading?: string;
  description?: string;
}

export interface PricingTier {
  number: string;
  title: string;
  description: string;
  badge?: string;
}

export interface PricingContent {
  label?: string;
  heading?: string;
  description?: string;
  tiers?: PricingTier[];
  includedItems?: string[];
}

export interface SocialProofContent {
  label?: string;
  heading?: string;
  description?: string;
}

export interface FaqContent {
  label?: string;
  heading?: string;
  description?: string;
}

export interface ContactContent {
  label?: string;
  heading?: string;
  description?: string;
  ctaText?: string;
  trustLine?: string;
}

export interface MapContent {
  heading?: string;
}

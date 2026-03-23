/**
 * categories.ts
 * Single source of truth for the 10 service categories.
 * Imported by registration UI, API validation, MCP server, and whitepages.
 */

export const CATEGORIES = [
  { slug: "delivery-errands", label: "Delivery & Errands" },
  { slug: "post-parcels", label: "Post & Parcels" },
  { slug: "home-maintenance", label: "Home Maintenance" },
  { slug: "garden-outdoors", label: "Garden & Outdoors" },
  { slug: "cleaning", label: "Cleaning" },
  { slug: "moving-hauling", label: "Moving & Hauling" },
  { slug: "pet-services", label: "Pet Services" },
  { slug: "photo-verification", label: "Photo & Verification" },
  { slug: "event-setup", label: "Event & Setup" },
  { slug: "personal-assistant", label: "Personal Assistant" },
] as const;

export type ServiceCategory = (typeof CATEGORIES)[number]["slug"];

const VALID_SLUGS = new Set<string>(CATEGORIES.map((c) => c.slug));

export const MIN_CATEGORIES = 1;
export const MAX_CATEGORIES = 2;

export function isValidCategory(s: string): s is ServiceCategory {
  return VALID_SLUGS.has(s);
}

export function validateCategorySelection(
  categories: string[],
): { valid: true } | { valid: false; error: string } {
  if (!Array.isArray(categories)) {
    return { valid: false, error: "categories must be an array" };
  }
  if (categories.length < MIN_CATEGORIES) {
    return { valid: false, error: `Select at least ${MIN_CATEGORIES} category` };
  }
  if (categories.length > MAX_CATEGORIES) {
    return { valid: false, error: `Maximum ${MAX_CATEGORIES} categories allowed` };
  }
  const invalid = categories.filter((c) => !isValidCategory(c));
  if (invalid.length > 0) {
    return { valid: false, error: `Invalid categories: ${invalid.join(", ")}` };
  }
  return { valid: true };
}

/** Approved types for new offerings; existing stored values remain readable. */
export const SERVICE_TYPES = [
  "AC Repair", "Cleaning", "Plumbing", "Electrical", "Installation",
  "Appliance Repair", "Painting", "Carpentry", "Moving", "Other Home Service",
] as const;

export function isServiceType(value: string) {
  return SERVICE_TYPES.some((type) => type === value);
}

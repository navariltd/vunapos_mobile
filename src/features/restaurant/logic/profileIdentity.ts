/**
 * A readable name and avatar initials from a Frappe user id. The id is the
 * user's email (or "Administrator"); "jane.wanjiru@cafe.co.ke" reads as
 * "Jane Wanjiru" with initials "JW".
 */
export function profileIdentity(userId: string | null | undefined): { name: string; initials: string } {
  const local = (userId || "").split("@")[0].trim();
  const words = local
    .split(/[._\-\s]+/)
    .map((word) => word.replace(/\d+$/, ""))
    .filter(Boolean);
  if (!words.length) return { name: "Signed in", initials: "?" };
  const name = words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)).toUpperCase();
  return { name, initials };
}

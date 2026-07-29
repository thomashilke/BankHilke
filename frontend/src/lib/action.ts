/** A parent's deposit/withdraw shortcut: carried through the URL from the
 * PWA home-screen shortcuts, the child-card quick buttons, and the
 * quick-action child picker, down to the deposit/withdraw form itself. */
export type Action = "deposit" | "withdraw";

export function isAction(value: string | null): value is Action {
  return value === "deposit" || value === "withdraw";
}

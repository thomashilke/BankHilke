import { useAuth } from "../auth/useAuth";

export function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initials = (user.first_name?.[0] ?? user.username[0]).toUpperCase();

  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 font-mono text-sm font-semibold text-white">
            BH
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink-900">BankHilke</p>
            <p className="text-xs text-ink-400">Family allowance banking</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-ink-500 sm:inline-block">
            {user.role}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-white">
              {initials}
            </div>
            <span className="text-sm font-medium text-ink-700">
              {user.first_name || user.username}
            </span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:border-ink-300 hover:bg-ink-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

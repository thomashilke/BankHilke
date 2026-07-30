import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { authApi } from "../api/endpoints";

// One <script> load per locale for the lifetime of the tab -- Google reads
// `hl` off the query string once, at load time, so a locale switch needs a
// fresh tag rather than reusing an already-loaded one.
const scriptPromises = new Map<string, Promise<void>>();

function loadGoogleScript(hl: string): Promise<void> {
  const src = `https://accounts.google.com/gsi/client?hl=${hl}`;
  let promise = scriptPromises.get(src);
  if (!promise) {
    const { promise: loaded, resolve, reject } = Promise.withResolvers<void>();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
    promise = loaded;
    scriptPromises.set(src, promise);
  }
  return promise;
}

/** Renders Google's own "Sign in with Google" button once a client id is
 * configured server-side (see GET /auth/google/); renders nothing at all
 * if Google sign-in isn't configured, rather than a broken control. */
export function GoogleSignInButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const { i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .googleConfig()
      .then((config) => {
        if (!cancelled && config.client_id) setClientId(config.client_id);
      })
      .catch(() => {
        // Google sign-in is an optional enhancement -- if the config
        // lookup fails, just don't offer the button.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleScript(i18n.language)
      .then(() => {
        if (cancelled || !window.google || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          text: "continue_with",
        });
      })
      .catch(() => {
        // Script failed to load (offline, blocked, ...) -- leave the
        // container empty rather than surfacing a broken button.
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, i18n.language, onCredential]);

  if (!clientId) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}

// Minimal ambient types for the subset of Google Identity Services (GIS)
// used by GoogleSignInButton. No official @types package exists for this
// script; see https://developers.google.com/identity/gsi/web/reference/js-reference.
export {};

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityAccounts {
  id: {
    initialize: (config: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
    }) => void;
    renderButton: (
      parent: HTMLElement,
      options: {
        theme?: "outline" | "filled_blue" | "filled_black";
        size?: "small" | "medium" | "large";
        width?: number;
        text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      },
    ) => void;
  };
}

declare global {
  interface Window {
    google?: { accounts: GoogleIdentityAccounts };
  }
}

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: "google" | "apple", _opts?: SignInOptions) => {
      return { error: new Error("OAuth sign-in is not configured in this Replit migration yet. Use email and password sign-in.") };
    },
  },
};

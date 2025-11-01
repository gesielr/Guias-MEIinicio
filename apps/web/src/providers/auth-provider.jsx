import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSdk } from "./sdk-provider";
import { supabase } from "../supabase/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const sdk = useSdk();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, []);


  const value = useMemo(
    () => ({
      session,
      challenge,
      async login(identifier, password) {
        const result = await sdk.auth.login({ identifier, password });
        if (result.challengeRequired) {
          setChallenge({ identifier });
          navigate("/auth/2fa");
         return result;
        }
         if (result.session) {
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token
          });
          setSession(result.session);
        }

        setProfile(result.profile ?? null);
        return result;
      },
      async register(payload) {
        const appMode = import.meta.env.VITE_APP_MODE ?? "mock";
        // Se Supabase não está configurado, sempre usar mock
        const supabaseConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseConfigured || appMode === "mock" || appMode === "development") {
          const mockSession = {
            access_token: `mock_access_token_${Math.random()}`,
            refresh_token: `mock_refresh_token_${Math.random()}`,
            user: {
              id: `mock-user-id-${Math.random()}`,
              email: payload.email,
              app_metadata: { provider: "email" },
              user_metadata: {
                name: payload.name,
                role: payload.role ?? 'partner',
                user_type: payload.role ?? 'partner'
              }
            }
          };
          await supabase.auth.setSession(mockSession);
          setSession(mockSession);
          return { session: mockSession };
        }

        const response = await sdk.auth.register(payload);

        if (response?.session) {
          await supabase.auth.setSession({
            access_token: response.session.access_token,
            refresh_token: response.session.refresh_token
          });
          setSession(response.session);
        }

        return response;
      },
      async verify2fa(code) {
        const result = await sdk.auth.verify2fa({ code });
        setSession(result);
        setChallenge(null);
        navigate("/dashboard");
      },
      logout() {
        setSession(null);
        navigate("/");
        setProfile(null);
      }
    }),
    [sdk, navigate, session, challenge, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return value;
}

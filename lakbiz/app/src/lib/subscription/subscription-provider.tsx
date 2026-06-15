"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { ensureUserOrg, fetchUserOrg } from "@/lib/supabase/auth-actions";
import { createBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { canAccess, daysUntil, isReadOnlyStatus } from "./can";
import { defaultTrialSubscription } from "./plans";
import type {
  BillingCycle,
  FeatureKey,
  OrganizationState,
  PlanId,
  SubscriptionContextValue,
  SubscriptionState,
} from "./types";

const DEMO_SUBSCRIPTION_KEY = "lakbiz-subscription-demo";
const DEMO_ORG_KEY = "lakbiz-org-demo";

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null,
);

function loadDemoSubscription(): SubscriptionState {
  if (typeof window === "undefined") {
    const trial = defaultTrialSubscription();
    return { ...trial, isDemo: true };
  }
  try {
    const raw = localStorage.getItem(DEMO_SUBSCRIPTION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SubscriptionState;
      return { ...parsed, isDemo: true };
    }
  } catch {
    /* use default */
  }
  const trial = defaultTrialSubscription();
  return { ...trial, isDemo: true };
}

function loadDemoOrg(): OrganizationState {
  if (typeof window === "undefined") {
    return { id: null, name: "Demo Shop", isAuthenticated: false };
  }
  try {
    const raw = localStorage.getItem(DEMO_ORG_KEY);
    if (raw) return JSON.parse(raw) as OrganizationState;
  } catch {
    /* use default */
  }
  return { id: null, name: "Demo Shop", isAuthenticated: false };
}

function toPlanId(id: string): PlanId {
  if (id === "starter" || id === "business" || id === "pro") return id;
  return "business";
}

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionState>(() => ({
    ...defaultTrialSubscription(),
    isDemo: true,
  }));
  const [org, setOrg] = useState<OrganizationState>({
    id: null,
    name: "Demo Shop",
    isAuthenticated: false,
  });

  const loadFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return false;

    let data = await fetchUserOrg();
    if (!data?.org) {
      const supabase = createBrowserClient();
      if (supabase) {
        const emailPrefix = user.email?.split("@")[0]?.trim();
        try {
          await ensureUserOrg(supabase, user.id, {
            shopName: emailPrefix,
          });
          data = await fetchUserOrg();
        } catch {
          /* org creation may fail if RLS blocks — shop save can retry */
        }
      }
    }

    if (!data?.org) return false;

    setOrg({
      id: data.org.id,
      name: data.org.name,
      isAuthenticated: true,
    });

    if (data.subscription) {
      setSubscription({
        planId: toPlanId(data.subscription.planId),
        status: data.subscription.status,
        billingCycle: data.subscription.billingCycle as BillingCycle,
        trialEndsAt: data.subscription.trialEndsAt,
        currentPeriodEnd: data.subscription.currentPeriodEnd,
        addons: [],
        isDemo: false,
      });
    } else {
      const trial = defaultTrialSubscription();
      setSubscription({ ...trial, isDemo: false });
    }
    return true;
  }, [user]);

  useEffect(() => {
    if (authLoading) return;

    const init = async () => {
      if (user && (await loadFromCloud())) {
        setReady(true);
        return;
      }
      setSubscription(loadDemoSubscription());
      setOrg(loadDemoOrg());
      setReady(true);
    };

    init();
  }, [user, authLoading, loadFromCloud]);

  useEffect(() => {
    if (!ready || !subscription.isDemo) return;
    localStorage.setItem(DEMO_SUBSCRIPTION_KEY, JSON.stringify(subscription));
  }, [subscription, ready]);

  useEffect(() => {
    if (!ready || org.isAuthenticated) return;
    localStorage.setItem(DEMO_ORG_KEY, JSON.stringify(org));
  }, [org, ready]);

  const setDemoPlan = useCallback((planId: PlanId) => {
    setSubscription((prev) => ({ ...prev, planId }));
  }, []);

  const setDemoBillingCycle = useCallback((billingCycle: BillingCycle) => {
    setSubscription((prev) => ({ ...prev, billingCycle }));
  }, []);

  const can = useCallback(
    (feature: FeatureKey) => canAccess(subscription, feature),
    [subscription],
  );

  const daysLeftInTrial = useMemo(() => {
    if (subscription.status !== "trialing") return null;
    return daysUntil(subscription.trialEndsAt);
  }, [subscription.status, subscription.trialEndsAt]);

  const isReadOnly = isReadOnlyStatus(subscription.status);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      org,
      subscription,
      can,
      daysLeftInTrial,
      isReadOnly,
      setDemoPlan,
      setDemoBillingCycle,
      refreshOrg: loadFromCloud,
    }),
    [
      org,
      subscription,
      can,
      daysLeftInTrial,
      isReadOnly,
      setDemoPlan,
      setDemoBillingCycle,
      loadFromCloud,
    ],
  );

  if (!ready) {
    return <>{children}</>;
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    const trial = defaultTrialSubscription();
    const sub: SubscriptionState = { ...trial, isDemo: true };
    return {
      org: { id: null, name: "Demo Shop", isAuthenticated: false },
      subscription: sub,
      can: (feature) => canAccess(sub, feature),
      daysLeftInTrial: daysUntil(trial.trialEndsAt),
      isReadOnly: false,
      setDemoPlan: () => {},
      setDemoBillingCycle: () => {},
      refreshOrg: async () => false,
    };
  }
  return ctx;
}

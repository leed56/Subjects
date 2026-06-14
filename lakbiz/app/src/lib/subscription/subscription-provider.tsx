"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

  useEffect(() => {
    setSubscription(loadDemoSubscription());
    setOrg(loadDemoOrg());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(DEMO_SUBSCRIPTION_KEY, JSON.stringify(subscription));
  }, [subscription, ready]);

  useEffect(() => {
    if (!ready) return;
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
    }),
    [
      org,
      subscription,
      can,
      daysLeftInTrial,
      isReadOnly,
      setDemoPlan,
      setDemoBillingCycle,
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
    };
  }
  return ctx;
}

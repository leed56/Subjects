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
import {
  ensureUserOrg,
  fetchUserOrg,
  isPlatformAdminClient,
} from "@/lib/supabase/auth-actions";
import { createBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { canAccess, daysUntil, isReadOnlyStatus } from "./can";
import { defaultTrialSubscription } from "./plans";
import {
  canAccessSettingsPath as checkSettingsPath,
  canAccessShopRoute as checkShopRoute,
  canManageTeam,
  canSeeFinancials,
  parseOrgRole,
} from "@/lib/org-role/permissions";
import type {
  BillingCycle,
  FeatureKey,
  OrganizationState,
  OrgRole,
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
    return { id: null, name: "Demo Shop", sector: "grocery", isAuthenticated: false, role: "owner" };
  }
  try {
    const raw = localStorage.getItem(DEMO_ORG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<OrganizationState>;
      return {
        id: parsed.id ?? null,
        name: parsed.name ?? "Demo Shop",
        sector: parsed.sector ?? "grocery",
        isAuthenticated: parsed.isAuthenticated ?? false,
        role: parseOrgRole(parsed.role),
      };
    }
  } catch {
    /* use default */
  }
  return { id: null, name: "Demo Shop", sector: "grocery", isAuthenticated: false, role: "owner" };
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
  const [ready, setReady] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>(() => ({
    ...defaultTrialSubscription(),
    isDemo: true,
  }));
  const [org, setOrg] = useState<OrganizationState>({
    id: null,
    name: "Demo Shop",
    sector: "grocery",
    isAuthenticated: false,
    role: "owner",
  });
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  const loadFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) return false;

    const supabase = createBrowserClient();
    if (supabase && (await isPlatformAdminClient(supabase))) {
      setIsPlatformAdmin(true);
      setOrg({
        id: null,
        name: "LakBiz Platform",
        sector: "grocery",
        isAuthenticated: true,
        role: "owner",
      });
      setSubscription({
        planId: "pro",
        status: "active",
        billingCycle: "monthly",
        trialEndsAt: null,
        currentPeriodEnd: null,
        addons: [],
        isDemo: false,
      });
      return true;
    }

    setIsPlatformAdmin(false);

    let data = await fetchUserOrg();
    if (!data?.org) {
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
      sector: data.org.sector,
      isAuthenticated: true,
      role: parseOrgRole(data.role),
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

    if (!user) {
      setIsPlatformAdmin(false);
      setSubscription(loadDemoSubscription());
      setOrg(loadDemoOrg());
      return;
    }

    void loadFromCloud().catch(() => {
      setSubscription(loadDemoSubscription());
      setOrg(loadDemoOrg());
    });
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
    (feature: FeatureKey) => canAccess(subscription, feature, org.sector),
    [subscription, org.sector],
  );

  const daysLeftInTrial = useMemo(() => {
    if (subscription.status !== "trialing") return null;
    return daysUntil(subscription.trialEndsAt);
  }, [subscription.status, subscription.trialEndsAt]);

  const isReadOnly = isReadOnlyStatus(subscription.status);
  const orgRole = org.role;

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      org,
      subscription,
      isPlatformAdmin,
      orgRole,
      canSeeFinancials: canSeeFinancials(orgRole),
      canManageTeam: canManageTeam(orgRole),
      canAccessShopRoute: (href: string) => checkShopRoute(orgRole, href),
      canAccessSettingsPath: (pathname: string) => checkSettingsPath(orgRole, pathname),
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
      isPlatformAdmin,
      orgRole,
      can,
      daysLeftInTrial,
      isReadOnly,
      setDemoPlan,
      setDemoBillingCycle,
      loadFromCloud,
    ],
  );

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
      org: { id: null, name: "Demo Shop", sector: "grocery", isAuthenticated: false, role: "owner" },
      subscription: sub,
      isPlatformAdmin: false,
      orgRole: "owner" as OrgRole,
      canSeeFinancials: true,
      canManageTeam: true,
      canAccessShopRoute: () => true,
      canAccessSettingsPath: () => true,
      can: (feature) => canAccess(sub, feature, "grocery"),
      daysLeftInTrial: daysUntil(trial.trialEndsAt),
      isReadOnly: false,
      setDemoPlan: () => {},
      setDemoBillingCycle: () => {},
      refreshOrg: async () => false,
    };
  }
  return ctx;
}

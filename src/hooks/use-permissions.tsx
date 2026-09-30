"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PERMISSION_KEYS, type PermissionKey, type PermissionMap } from "@/lib/permissions";

export type { PermissionKey, PermissionMap } from "@/lib/permissions";

type PermissionContextValue = {
  isAdmin: boolean;
  ownedPersonId: string | null;
  permissions: PermissionMap | null;
  loading: boolean;
  error: string | null;
  can: (permission: PermissionKey) => boolean;
  reload: () => Promise<void>;
};

const PermissionContext = createContext<PermissionContextValue | null>(null);

function allPermissions(value: boolean): PermissionMap {
  return Object.fromEntries(PERMISSION_KEYS.map((key) => [key, value])) as PermissionMap;
}

export function PermissionsProvider({
  children,
  isAdmin,
}: {
  children: ReactNode;
  isAdmin: boolean;
}) {
  const [permissions, setPermissions] = useState<PermissionMap | null>(
    isAdmin ? allPermissions(true) : null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownedPersonId, setOwnedPersonId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/permissions", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.permissions) {
        throw new Error(data?.error || "Could not load your access settings.");
      }
      setPermissions(data.permissions as PermissionMap);
      setOwnedPersonId(typeof data.ownedPersonId === "string" ? data.ownedPersonId : null);
      setError(null);
    } catch (cause) {
      setPermissions(allPermissions(false));
      setOwnedPersonId(null);
      setError(cause instanceof Error ? cause.message : "Could not load your access settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [reload]);

  const can = useCallback(
    (permission: PermissionKey) => permissions?.[permission] === true,
    [permissions]
  );

  const value = useMemo(
    () => ({ permissions, loading, error, can, reload, isAdmin, ownedPersonId }),
    [permissions, loading, error, can, reload, isAdmin, ownedPersonId]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

const adminFallback: PermissionContextValue = {
  isAdmin: false,
  ownedPersonId: null,
  permissions: allPermissions(false),
  loading: false,
  error: null,
  can: () => false,
  reload: async () => {},
};

export function usePermissions() {
  return useContext(PermissionContext) ?? adminFallback;
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type {
  CreatePlatformMembershipDto,
  CreateTenantDto,
  PlatformAdminSummary,
  PlatformTenantListResponse,
  PlatformTenantOption,
  PlatformTenantSummary,
} from '@leadops/shared';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { TENANT_PAGE_SIZE } from './platform-admin.constants';
import {
  emptyMembershipForm,
  emptyTenantForm,
  normalizeSortOrder,
  normalizeTenantSortBy,
  parsePositiveInt,
} from './platform-admin.form-factories';
import { createMembership, createTenant, getPlatformSummary, listPlatformTenants, listTenantOptions } from './platform-admin.api';
import type { MembershipFormState, SortOrder, TenantFormState, TenantSortBy } from './platform-admin.types';

export type PlatformAdminListState = {
  page: number;
  queryParam: string;
  sortBy: TenantSortBy;
  sortOrder: SortOrder;
  queryInput: string;
  setQueryInput: React.Dispatch<React.SetStateAction<string>>;
  updateListParams: (patch: Record<string, string | null>) => void;

  summary: PlatformAdminSummary | null;
  summaryLoading: boolean;
  tenants: PlatformTenantSummary[];
  total: number;
  totalPages: number;
  tenantsLoading: boolean;
  tableFooterLabel: string;

  createTenantOpen: boolean;
  setCreateTenantOpen: React.Dispatch<React.SetStateAction<boolean>>;
  savingTenant: boolean;
  tenantForm: TenantFormState;
  setTenantForm: React.Dispatch<React.SetStateAction<TenantFormState>>;

  createAccessOpen: boolean;
  setCreateAccessOpen: React.Dispatch<React.SetStateAction<boolean>>;
  savingMembership: boolean;
  membershipForm: MembershipFormState;
  setMembershipForm: React.Dispatch<React.SetStateAction<MembershipFormState>>;
  tenantOptionQuery: string;
  setTenantOptionQuery: React.Dispatch<React.SetStateAction<string>>;
  tenantOptions: PlatformTenantOption[];
  tenantOptionsLoading: boolean;

  tableEmpty: boolean;
  loadSummary: () => Promise<void>;
  loadTenants: () => Promise<void>;
  loadTenantOptions: (query: string) => Promise<void>;
  runCreateTenant: (afterSuccess?: () => Promise<void> | void) => Promise<void>;
  runCreateMembership: (afterSuccess?: () => Promise<void> | void) => Promise<void>;
};

export function usePlatformAdminList(): PlatformAdminListState {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePositiveInt(searchParams.get('page'), 1);
  const queryParam = (searchParams.get('q') ?? '').trim();
  const sortBy = normalizeTenantSortBy(searchParams.get('sortBy'));
  const sortOrder = normalizeSortOrder(searchParams.get('sortOrder'));

  const [summary, setSummary] = useState<PlatformAdminSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tenantsLoading, setTenantsLoading] = useState(true);

  const [queryInput, setQueryInput] = useState(queryParam);
  const debouncedQueryInput = useDebouncedValue(queryInput.trim(), 350);

  const [createTenantOpen, setCreateTenantOpen] = useState(false);
  const [createAccessOpen, setCreateAccessOpen] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);
  const [tenantForm, setTenantForm] = useState<TenantFormState>(emptyTenantForm);
  const [membershipForm, setMembershipForm] = useState<MembershipFormState>(emptyMembershipForm);

  const [tenantOptionQuery, setTenantOptionQuery] = useState('');
  const debouncedTenantOptionQuery = useDebouncedValue(tenantOptionQuery, 250);
  const [tenantOptions, setTenantOptions] = useState<PlatformTenantOption[]>([]);
  const [tenantOptionsLoading, setTenantOptionsLoading] = useState(false);

  const updateListParams = useCallback((patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value.trim().length === 0) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }

    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const loadSummary = useCallback(async (): Promise<void> => {
    setSummaryLoading(true);
    try {
      const response = await getPlatformSummary();
      setSummary(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load platform summary');
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async (): Promise<void> => {
    setTenantsLoading(true);
    try {
      const response: PlatformTenantListResponse = await listPlatformTenants({
        page,
        pageSize: TENANT_PAGE_SIZE,
        sortBy,
        sortOrder,
        q: queryParam,
      });

      if (response.total > 0 && response.page > response.totalPages) {
        updateListParams({ page: String(response.totalPages) });
        return;
      }

      setTenants(response.items);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load tenants');
      setTenants([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setTenantsLoading(false);
    }
  }, [page, queryParam, sortBy, sortOrder, updateListParams]);

  const loadTenantOptions = useCallback(async (query: string): Promise<void> => {
    setTenantOptionsLoading(true);
    try {
      const response = await listTenantOptions(query, 30);
      setTenantOptions(response);
      setMembershipForm((current) => {
        if (current.tenantId || response.length === 0) {
          return current;
        }

        return {
          ...current,
          tenantId: response[0]?.id ?? '',
        };
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load tenant options');
      setTenantOptions([]);
    } finally {
      setTenantOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    setQueryInput(queryParam);
  }, [queryParam]);

  useEffect(() => {
    if (debouncedQueryInput === queryParam) {
      return;
    }

    updateListParams({
      q: debouncedQueryInput || null,
      page: '1',
    });
  }, [debouncedQueryInput, queryParam, updateListParams]);

  useEffect(() => {
    if (!createAccessOpen) {
      return;
    }

    void loadTenantOptions(debouncedTenantOptionQuery);
  }, [createAccessOpen, debouncedTenantOptionQuery, loadTenantOptions]);

  useEffect(() => {
    if (!createAccessOpen) {
      setTenantOptionQuery('');
      return;
    }

    void loadTenantOptions('');
  }, [createAccessOpen, loadTenantOptions]);

  const runCreateTenant = useCallback(async (afterSuccess?: () => Promise<void> | void): Promise<void> => {
    setSavingTenant(true);
    try {
      const payload: CreateTenantDto = {
        ...tenantForm,
        name: tenantForm.name.trim(),
        slug: tenantForm.slug.trim().toLowerCase(),
        adminName: tenantForm.adminName.trim(),
        adminEmail: tenantForm.adminEmail.trim().toLowerCase(),
        adminPhone: tenantForm.adminPhone.trim(),
        adminPassword: tenantForm.adminPassword,
      };

      await createTenant(payload);
      toast.success('Tenant created');
      setCreateTenantOpen(false);
      setTenantForm(emptyTenantForm());
      await Promise.all([loadSummary(), loadTenants()]);
      if (createAccessOpen) {
        await loadTenantOptions(tenantOptionQuery);
      }
      if (afterSuccess) {
        await afterSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tenant');
    } finally {
      setSavingTenant(false);
    }
  }, [tenantForm, loadSummary, loadTenants, createAccessOpen, loadTenantOptions, tenantOptionQuery]);

  const runCreateMembership = useCallback(async (afterSuccess?: () => Promise<void> | void): Promise<void> => {
    setSavingMembership(true);
    try {
      const payload: CreatePlatformMembershipDto = {
        tenantId: membershipForm.tenantId,
        name: membershipForm.name.trim(),
        email: membershipForm.email.trim().toLowerCase(),
        phone: membershipForm.phone.trim(),
        password: membershipForm.password.trim() || undefined,
        isTenantAdmin: membershipForm.isTenantAdmin,
      };

      await createMembership(payload);
      toast.success('Access created');
      setCreateAccessOpen(false);
      setMembershipForm(emptyMembershipForm());
      await Promise.all([loadSummary(), loadTenants()]);
      if (afterSuccess) {
        await afterSuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create access');
    } finally {
      setSavingMembership(false);
    }
  }, [membershipForm, loadSummary, loadTenants]);

  const tableFooterLabel = useMemo(() => {
    if (total === 0) {
      return '0 tenants';
    }

    const start = (page - 1) * TENANT_PAGE_SIZE + 1;
    const end = Math.min(page * TENANT_PAGE_SIZE, total);
    return `${start}-${end} of ${total} tenants`;
  }, [page, total]);

  const tableEmpty = !tenantsLoading && tenants.length === 0;

  return {
    page,
    queryParam,
    sortBy,
    sortOrder,
    queryInput,
    setQueryInput,
    updateListParams,

    summary,
    summaryLoading,
    tenants,
    total,
    totalPages,
    tenantsLoading,
    tableFooterLabel,

    createTenantOpen,
    setCreateTenantOpen,
    savingTenant,
    tenantForm,
    setTenantForm,

    createAccessOpen,
    setCreateAccessOpen,
    savingMembership,
    membershipForm,
    setMembershipForm,
    tenantOptionQuery,
    setTenantOptionQuery,
    tenantOptions,
    tenantOptionsLoading,

    tableEmpty,
    loadSummary,
    loadTenants,
    loadTenantOptions,
    runCreateTenant,
    runCreateMembership,
  };
}

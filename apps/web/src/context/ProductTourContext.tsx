import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AuthUser } from '@leadops/shared';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from './AuthContext';

interface ProductTourStep {
  id: string;
  title: string;
  description: string;
  route?: string;
  selector?: string;
  permission?: string;
  superAdminOnly?: boolean;
  visibleWhen?: (input: { user: AuthUser | null }) => boolean;
}

interface ProductTourContextValue {
  isTourOpen: boolean;
  startTour: (startStepId?: string) => void;
  closeTour: () => void;
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

const TOUR_STEPS: ProductTourStep[] = [
  {
    id: 'workspace',
    title: 'Workspace home',
    description: 'This header shows your tenant context. Use it to quickly return to your default home screen.',
    selector: '[data-tour-id="workspace-home"]',
  },
  {
    id: 'branch',
    title: 'Branch context',
    description: 'Switch branch scope here. Lists and due queues automatically follow your selected branch.',
    selector: '[data-tour-id="branch-switcher"]',
    visibleWhen: ({ user }) => (user?.branchScope.branchIds.length ?? 0) > 1,
  },
  {
    id: 'dashboard',
    title: 'Operations dashboard',
    description: 'Review daily metrics and pipeline health cards for your tenant.',
    route: '/owner/dashboard',
    selector: '[data-tour-id="dashboard-overview"]',
    permission: 'dashboard.view',
  },
  {
    id: 'today',
    title: 'Today queue',
    description: 'Track due and overdue follow-ups, then mark tasks done from this queue.',
    route: '/staff/today',
    selector: '[data-tour-id="today-queue"]',
    permission: 'followups.view',
  },
  {
    id: 'leads',
    title: 'Pipeline list',
    description: 'Search and filter records by stage and branch. Open any row for detail and activity history.',
    route: '/leads',
    selector: '[data-tour-id="leads-list"]',
    permission: 'enquiries.view',
  },
  {
    id: 'leads-create',
    title: 'Create record',
    description: 'Create a new record quickly. Branch and next follow-up defaults help reduce clicks.',
    route: '/leads',
    selector: '[data-tour-id="leads-create-button"]',
    permission: 'enquiries.create',
  },
  {
    id: 'settings',
    title: 'Tenant settings',
    description: 'Manage reminder rules, timezone, and business hours for your tenant.',
    route: '/settings',
    selector: '[data-tour-id="settings-reminders"]',
    permission: 'settings.view',
  },
  {
    id: 'team',
    title: 'Team management',
    description: 'Create users and configure branch scope/default branch based on user access.',
    route: '/settings/team',
    selector: '[data-tour-id="team-create-user"]',
    permission: 'users.manage',
  },
  {
    id: 'roles',
    title: 'Role management',
    description: 'Create permission bundles and assign them consistently across your tenant.',
    route: '/settings/roles',
    selector: '[data-tour-id="roles-create-role"]',
    permission: 'roles.manage',
  },
  {
    id: 'platform',
    title: 'Platform operations',
    description: 'Superadmins can manage tenant-level users, branches, settings, roles, and audits from one place.',
    route: '/platform/admin',
    selector: '[data-tour-id="platform-tenant-directory"]',
    superAdminOnly: true,
  },
  {
    id: 'support',
    title: 'Help & support',
    description: 'Use these support channels anytime for login issues, access issues, or workflow questions.',
    selector: '[data-tour-id="support-button"]',
  },
];

export function ProductTourProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isTourOpen, setIsTourOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const highlightedElementRef = useRef<HTMLElement | null>(null);
  const lastRequestedStepIdRef = useRef<string | null>(null);

  const availableSteps = useMemo(() => {
    return TOUR_STEPS.filter((step) => {
      if (step.superAdminOnly && !user?.isSuperAdmin) {
        return false;
      }
      if (step.permission && !can(step.permission)) {
        return false;
      }
      if (step.visibleWhen && !step.visibleWhen({ user })) {
        return false;
      }
      return true;
    });
  }, [can, user]);

  const currentStep = availableSteps[stepIndex] ?? null;

  const clearHighlight = useCallback(() => {
    if (!highlightedElementRef.current) {
      return;
    }
    highlightedElementRef.current.classList.remove('tour-highlight');
    highlightedElementRef.current.removeAttribute('data-tour-active');
    highlightedElementRef.current = null;
  }, []);

  const focusCurrentTarget = useCallback((shouldScroll = true): boolean => {
    clearHighlight();

    if (!currentStep?.selector) {
      return false;
    }

    const target = document.querySelector<HTMLElement>(currentStep.selector);
    if (!target) {
      return false;
    }

    target.classList.add('tour-highlight');
    target.setAttribute('data-tour-active', 'true');
    if (shouldScroll) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
    highlightedElementRef.current = target;
    return true;
  }, [clearHighlight, currentStep?.selector]);

  const closeTour = useCallback(() => {
    setIsTourOpen(false);
    setStepIndex(0);
    lastRequestedStepIdRef.current = null;
    clearHighlight();
  }, [clearHighlight]);

  const startTour = useCallback((startStepId?: string) => {
    if (availableSteps.length === 0) {
      toast.error('No guided tour is available for your current access');
      return;
    }

    const nextIndex = startStepId
      ? Math.max(0, availableSteps.findIndex((step) => step.id === startStepId))
      : 0;

    setStepIndex(nextIndex);
    setIsTourOpen(true);
    lastRequestedStepIdRef.current = availableSteps[nextIndex]?.id ?? null;
  }, [availableSteps]);

  const goPrevious = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((current) => {
      const atLastStep = current >= availableSteps.length - 1;
      if (atLastStep) {
        closeTour();
        toast.success('Tour completed');
        return 0;
      }
      return current + 1;
    });
  }, [availableSteps.length, closeTour]);

  useEffect(() => {
    if (!isTourOpen || !currentStep) {
      clearHighlight();
      return;
    }

    if (currentStep.route && location.pathname !== currentStep.route) {
      void navigate(currentStep.route);
      return;
    }

    const timer = window.setTimeout(() => {
      focusCurrentTarget(true);
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clearHighlight, currentStep, focusCurrentTarget, isTourOpen, location.pathname, navigate]);

  useEffect(() => {
    if (!isTourOpen) {
      clearHighlight();
    }
  }, [clearHighlight, isTourOpen]);

  useEffect(() => {
    if (!isTourOpen) {
      return;
    }

    if (!currentStep) {
      closeTour();
      return;
    }

    if (!availableSteps.some((step) => step.id === currentStep.id)) {
      const fallbackIndex = Math.max(
        0,
        availableSteps.findIndex((step) => step.id === lastRequestedStepIdRef.current),
      );
      setStepIndex(fallbackIndex >= 0 ? fallbackIndex : 0);
    }
  }, [availableSteps, closeTour, currentStep, isTourOpen]);

  const value = useMemo<ProductTourContextValue>(() => ({
    isTourOpen,
    startTour,
    closeTour,
  }), [closeTour, isTourOpen, startTour]);

  const stepNumber = Math.min(stepIndex + 1, availableSteps.length);
  const isLastStep = stepNumber >= availableSteps.length;

  return (
    <ProductTourContext.Provider value={value}>
      {children}

      {isTourOpen && currentStep ? (
        <div className="pointer-events-none fixed inset-0 z-[70]">
          <div className="pointer-events-auto absolute bottom-4 right-4 w-[min(26rem,calc(100vw-1rem))] sm:bottom-6 sm:right-6">
            <Card className="border-white/80 bg-card/95 shadow-[0_26px_60px_-34px_rgba(15,23,42,0.5)]">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Guided Tour
                  </p>
                  <button
                    type="button"
                    onClick={closeTour}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Close tour"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <CardTitle className="text-base">
                  Step {stepNumber} of {availableSteps.length}: {currentStep.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const focused = focusCurrentTarget(true);
                      if (!focused) {
                        toast.message('No visual target found on this step', {
                          description: 'You can continue to the next step.',
                        });
                      }
                    }}
                    className="w-full"
                  >
                    Focus area
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={closeTour}
                    className="w-full"
                  >
                    Skip tour
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    onClick={goPrevious}
                    disabled={stepIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button onClick={goNext}>
                    {isLastStep ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Finish
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </ProductTourContext.Provider>
  );
}

export function useProductTour(): ProductTourContextValue {
  const context = useContext(ProductTourContext);
  if (!context) {
    throw new Error('useProductTour must be used within ProductTourProvider');
  }
  return context;
}

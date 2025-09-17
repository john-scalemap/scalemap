# Frontend Architecture

ScaleMap's frontend is built with **Next.js 14** using the App Router, optimized for the complex multi-agent assessment workflow and real-time progress tracking. The architecture balances professional UX with technical performance.

## Component Architecture

ScaleMap implements a **feature-based component architecture** that mirrors the business domains and assessment workflow stages.

### Component Organization
```
apps/web/src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth layout group
│   │   ├── login/                # Login page
│   │   └── register/             # Registration page
│   ├── (dashboard)/              # Authenticated layout group
│   │   ├── dashboard/            # Main dashboard
│   │   ├── assessment/           # Assessment workflow
│   │   │   ├── new/              # Create assessment
│   │   │   ├── [id]/             # Assessment details
│   │   │   └── [id]/progress/    # Real-time progress
│   │   ├── results/              # Results and deliverables
│   │   │   └── [assessmentId]/   # Specific assessment results
│   │   └── settings/             # Company settings
│   ├── api/                      # API routes (if needed)
│   ├── globals.css               # Global styles
│   └── layout.tsx                # Root layout
├── components/                   # Reusable components
│   ├── ui/                       # Base UI components (buttons, inputs, etc.)
│   ├── auth/                     # Authentication components
│   ├── assessment/               # Assessment-specific components
│   │   ├── questionnaire/        # 12-domain questionnaire
│   │   ├── progress/             # Progress tracking
│   │   └── agents/               # Agent personality display
│   ├── results/                  # Results visualization
│   │   ├── heatmap/              # Operational health heatmaps
│   │   ├── recommendations/      # Priority recommendations
│   │   └── validation/           # Client validation interface
│   └── shared/                   # Shared utility components
├── hooks/                        # Custom React hooks
│   ├── useAssessment.ts          # Assessment state management
│   ├── useRealTimeProgress.ts    # WebSocket progress tracking
│   ├── useAgents.ts              # Agent information and status
│   └── useAuth.ts                # Authentication state
├── lib/                          # Utility libraries
│   ├── api/                      # API client and types
│   ├── auth/                     # Auth utilities (Cognito)
│   ├── websocket/                # WebSocket client
│   └── utils/                    # General utilities
├── stores/                       # State management
│   ├── assessment-store.ts       # Assessment state (Zustand)
│   ├── auth-store.ts             # Auth state
│   └── ui-store.ts               # UI state (modals, notifications)
└── types/                        # TypeScript type definitions
    ├── assessment.ts             # Assessment-related types
    ├── agent.ts                  # Agent types
    └── api.ts                    # API response types
```

### Component Template (Feature Component)
```typescript
// Example: AssessmentProgressTracker component
'use client';

import { useEffect } from 'react';
import { useRealTimeProgress } from '@/hooks/useRealTimeProgress';
import { useAssessment } from '@/hooks/useAssessment';
import { AgentCard } from '@/components/assessment/agents/AgentCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';

interface AssessmentProgressTrackerProps {
  assessmentId: string;
}

export function AssessmentProgressTracker({ assessmentId }: AssessmentProgressTrackerProps) {
  const { assessment, isLoading } = useAssessment(assessmentId);
  const { 
    progress, 
    activeAgents, 
    recentActivity, 
    connectionStatus,
    connect,
    disconnect 
  } = useRealTimeProgress(assessmentId);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  if (isLoading) return <ProgressSkeleton />;

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Assessment Progress</h3>
          <ProgressBar 
            value={progress.overall} 
            className="mb-2"
          />
          <p className="text-sm text-gray-600">
            {progress.stage} - {progress.eta}
          </p>
        </div>
      </Card>

      {/* Active Agents */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Active Experts</h3>
          <div className="grid gap-4">
            {activeAgents.map(agent => (
              <AgentCard 
                key={agent.id}
                agent={agent}
                status={progress.agents[agent.id]}
                showProgress={true}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map(activity => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      </Card>

      {/* Connection Status */}
      <ConnectionIndicator status={connectionStatus} />
    </div>
  );
}
```

## State Management Architecture

ScaleMap uses **Zustand** for client state and **React Query (TanStack Query)** for server state, providing optimal performance for the assessment workflow.

### State Structure
```typescript
// Assessment Store (Zustand)
interface AssessmentState {
  // Current assessment data
  currentAssessment: Assessment | null;
  
  // Assessment workflow state
  workflowState: {
    currentStep: AssessmentStep;
    completedSteps: AssessmentStep[];
    canProceed: boolean;
    validationErrors: Record<string, string>;
  };
  
  // Real-time progress state
  progressState: {
    overall: number;
    agents: Record<string, AgentProgress>;
    stage: AssessmentStage;
    eta: string;
    lastUpdate: Date;
  };
  
  // Actions
  setCurrentAssessment: (assessment: Assessment) => void;
  updateWorkflowState: (state: Partial<WorkflowState>) => void;
  updateProgress: (progress: ProgressUpdate) => void;
  resetAssessment: () => void;
}

// Auth Store (Zustand)  
interface AuthState {
  user: User | null;
  company: Company | null;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
  };
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshTokens: () => Promise<void>;
  updateCompany: (company: Partial<Company>) => Promise<void>;
}

// UI Store (Zustand)
interface UIState {
  // Modal state
  modals: {
    clarificationRequest: boolean;
    agentDetails: boolean;
    validationFeedback: boolean;
  };
  
  // Notification state
  notifications: Notification[];
  
  // Loading states
  loadingStates: Record<string, boolean>;
  
  // Actions
  openModal: (modalName: keyof UIState['modals']) => void;
  closeModal: (modalName: keyof UIState['modals']) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  setLoading: (key: string, loading: boolean) => void;
}
```

### State Management Patterns
```typescript
// Custom hook for assessment management
export function useAssessment(assessmentId: string) {
  const store = useAssessmentStore();
  
  // Server state with React Query
  const { data: assessment, isLoading, error } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => apiClient.getAssessment(assessmentId),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    enabled: !!assessmentId,
  });

  // Sync server state with local store
  useEffect(() => {
    if (assessment) {
      store.setCurrentAssessment(assessment);
    }
  }, [assessment, store]);

  // Mutation for updating assessment
  const updateAssessmentMutation = useMutation({
    mutationFn: (updates: Partial<Assessment>) => 
      apiClient.updateAssessment(assessmentId, updates),
    onSuccess: (updatedAssessment) => {
      // Optimistic update
      queryClient.setQueryData(['assessment', assessmentId], updatedAssessment);
      store.setCurrentAssessment(updatedAssessment);
    },
  });

  return {
    assessment: store.currentAssessment || assessment,
    isLoading,
    error,
    updateAssessment: updateAssessmentMutation.mutate,
    isUpdating: updateAssessmentMutation.isPending,
  };
}
```

## Routing Architecture

ScaleMap uses **Next.js App Router** with strategic route organization for the assessment workflow.

### Route Organization
```
app/
├── (auth)/                       # Authentication routes (no header/nav)
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── layout.tsx                # Auth-specific layout
├── (dashboard)/                  # Main application (with navigation)
│   ├── dashboard/
│   │   └── page.tsx              # Main dashboard
│   ├── assessment/
│   │   ├── new/
│   │   │   └── page.tsx          # Create new assessment
│   │   ├── [id]/
│   │   │   ├── page.tsx          # Assessment overview
│   │   │   ├── questionnaire/
│   │   │   │   └── page.tsx      # Complete questionnaire
│   │   │   ├── progress/
│   │   │   │   └── page.tsx      # Real-time progress
│   │   │   ├── validation/
│   │   │   │   └── page.tsx      # 48h validation
│   │   │   └── results/
│   │   │       └── page.tsx      # Final results
│   │   └── layout.tsx            # Assessment workflow layout
│   ├── results/
│   │   ├── page.tsx              # All results
│   │   └── [assessmentId]/
│   │       ├── page.tsx          # Specific results
│   │       ├── executive-summary/
│   │       ├── detailed-report/
│   │       └── implementation-kit/
│   ├── settings/
│   │   ├── page.tsx              # Company settings
│   │   ├── profile/
│   │   └── billing/
│   └── layout.tsx                # Main dashboard layout
└── api/                          # API routes (if needed for webhooks)
    └── webhooks/
        └── stripe/
            └── route.ts          # Stripe webhook handler
```

### Protected Route Pattern
```typescript
// middleware.ts - Route protection
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/token-verification';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return NextResponse.next();
  }
  
  // Protected routes
  const token = request.cookies.get('access-token')?.value;
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

// Layout with authentication check
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company } = useAuth();
  
  if (!user) {
    return <AuthRedirect />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} company={company} />
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
```

## Frontend Services Layer

ScaleMap implements a **services layer** that abstracts API communication and provides consistent data handling.

### API Client Setup
```typescript
// lib/api/client.ts
class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.scalemap.ai/v1';
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  }

  // Assessment endpoints
  async getAssessment(id: string): Promise<Assessment> {
    return this.request(`/assessments/${id}`);
  }

  async createAssessment(data: CreateAssessmentRequest): Promise<Assessment> {
    return this.request('/assessments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAssessment(id: string, data: Partial<Assessment>): Promise<Assessment> {
    return this.request(`/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Agent endpoints
  async getAgents(): Promise<Agent[]> {
    return this.request('/agents');
  }

  // Results endpoints
  async getAssessmentAnalysis(assessmentId: string): Promise<AgentAnalysisResult[]> {
    return this.request(`/assessments/${assessmentId}/analysis`);
  }

  async getDeliverables(assessmentId: string): Promise<Deliverable[]> {
    return this.request(`/assessments/${assessmentId}/deliverables`);
  }

  // Validation endpoints
  async submitValidation(assessmentId: string, feedback: ValidationFeedback): Promise<void> {
    return this.request(`/assessments/${assessmentId}/validation`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  }
}

export const apiClient = new ApiClient();
```

### Service Example (Assessment Service)
```typescript
// lib/services/assessment-service.ts
export class AssessmentService {
  // Create new assessment with company context
  async createAssessment(
    companyId: string,
    responses: Record<string, any>,
    context: AssessmentContext
  ): Promise<Assessment> {
    const assessment = await apiClient.createAssessment({
      companyId,
      domainResponses: responses,
      assessmentContext: context,
    });

    // Analytics tracking
    analytics.track('assessment_created', {
      assessmentId: assessment.assessmentId,
      companyId,
      domains: Object.keys(responses).length,
    });

    return assessment;
  }

  // Submit validation feedback
  async submitValidation(
    assessmentId: string,
    feedback: ValidationFeedback
  ): Promise<void> {
    await apiClient.submitValidation(assessmentId, feedback);

    // Track validation completion
    analytics.track('validation_completed', {
      assessmentId,
      changesRequested: feedback.priorityConfirmation.some(p => !p.confirmed),
    });
  }

  // Request clarification
  async requestClarification(
    assessmentId: string,
    clarificationRequest: ClarificationRequest
  ): Promise<void> {
    await apiClient.request(`/assessments/${assessmentId}/clarifications`, {
      method: 'POST',
      body: JSON.stringify(clarificationRequest),
    });

    // Track clarification requests
    analytics.track('clarification_requested', {
      assessmentId,
      reason: clarificationRequest.reason,
      affectedDomains: clarificationRequest.affectedDomains,
    });
  }
}

export const assessmentService = new AssessmentService();
```

## Real-time Progress Integration

ScaleMap implements **WebSocket connections** for real-time progress updates during the 72-hour assessment period.

```typescript
// hooks/useRealTimeProgress.ts
export function useRealTimeProgress(assessmentId: string) {
  const [progress, setProgress] = useState<ProgressState>({
    overall: 0,
    agents: {},
    stage: 'initializing',
    eta: 'Calculating...',
    lastUpdate: new Date(),
  });

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = authStore.getState().tokens.accessToken;
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/assessments/${assessmentId}?token=${token}`;
    
    wsRef.current = new WebSocket(wsUrl);
    setConnectionStatus('connecting');

    wsRef.current.onopen = () => {
      setConnectionStatus('connected');
    };

    wsRef.current.onmessage = (event) => {
      const message: ProgressMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'agent_progress':
          setProgress(prev => ({
            ...prev,
            agents: {
              ...prev.agents,
              [message.agentId]: {
                progress: message.progress,
                status: message.status,
                message: message.message,
              }
            },
            overall: calculateOverallProgress(prev.agents, message),
            lastUpdate: new Date(),
          }));
          break;

        case 'deliverable_ready':
          setRecentActivity(prev => [
            {
              id: Date.now().toString(),
              type: 'deliverable',
              message: `${message.deliverable} is ready for download`,
              timestamp: new Date(),
              action: {
                label: 'Download',
                url: message.downloadUrl,
              }
            },
            ...prev.slice(0, 9), // Keep last 10 activities
          ]);
          break;

        case 'agent_started':
          setRecentActivity(prev => [
            {
              id: Date.now().toString(),
              type: 'agent',
              message: `${message.agentName} started analyzing ${message.domain}`,
              timestamp: new Date(),
            },
            ...prev.slice(0, 9),
          ]);
          break;
      }
    };

    wsRef.current.onclose = () => {
      setConnectionStatus('disconnected');
      // Retry connection after 5 seconds
      setTimeout(connect, 5000);
    };

  }, [assessmentId]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    setConnectionStatus('disconnected');
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    progress,
    connectionStatus,
    recentActivity,
    activeAgents: Object.keys(progress.agents).filter(id => 
      progress.agents[id].status === 'active'
    ),
    connect,
    disconnect,
  };
}
```

This frontend architecture provides a **professional, scalable foundation** for ScaleMap's complex assessment workflow while maintaining excellent performance and user experience throughout the 72-hour delivery process.

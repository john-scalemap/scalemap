# High Level Architecture

## Technical Summary

ScaleMap employs a **Hybrid Monolith-First Architecture** with embedded microservices boundaries, optimizing for rapid market validation while preserving enterprise scalability options. The system combines Next.js frontend with Node.js/Express backend, featuring intelligent AI agent orchestration through an internal event bus that can easily migrate to external message queues.

The architecture centers on a **Perfect Prioritization Pipeline** that uses single-call domain triage to activate 3-5 specialist agents from a pool of 12, reducing OpenAI API costs by 50-60% while maintaining consultant-quality analysis. All components communicate through well-defined internal service boundaries using dependency injection patterns, enabling seamless extraction to microservices when scaling demands exceed 10-15 concurrent assessments.

The platform delivers staged results (24/48/72 hours) through automated pipeline orchestration with client validation integration, supporting the £300-500K ARR target through 40+ monthly assessments once refactored to distributed architecture.

## Platform and Infrastructure Choice

**Platform:** AWS Full Stack (Future-Ready Architecture)
**Key Services:** Next.js on Amplify Hosting, Cognito Auth, RDS PostgreSQL, Lambda Functions, API Gateway, Step Functions, S3, CloudFront, EventBridge
**Deployment Host and Regions:** AWS Multi-Region (us-east-1 primary, eu-west-1 for GDPR compliance)

**Rationale:** AWS provides enterprise-grade capabilities from day one while offering substantial free tier coverage. The architecture can scale from MVP to enterprise without platform migration, and services like Step Functions are purpose-built for multi-agent orchestration workflows. EventBridge enables sophisticated agent coordination with built-in retry and dead letter queue capabilities. Initial costs are actually lower than Vercel/Supabase due to free tier benefits, while providing superior compliance and scalability features.

## Agent Orchestration System

**Core Agent Processing Pipeline:**
- **Triage System:** 1-5 scoring system determines 3-5 agent activation from 12 specialist pool
- **Processing Window:** 45-120 minutes total (20-30min individual analysis + 15-30min collaboration)  
- **Activation Logic:** Mandatory combinations (Strategy+People+Change, Revenue+Customer, Operations+Technology)
- **Cost Optimization:** Intelligent agent selection reduces API costs by 50-60% vs. full activation

**Agent Coordination Architecture:**
```
Assessment → Triage Algorithm → Agent Selection → Parallel Analysis → 
Cross-Agent Collaboration → Perfect Prioritization → Quality Gates → Delivery
```

**Critical Integration Points:**
- Agent Personas Database drives UI personality framework and email attribution
- Assessment Questions Database enables branching logic and follow-up generation
- Perfect Prioritization Algorithm processes cross-domain dependencies and impact scoring

## Perfect Prioritization Algorithm

**Core Algorithm Logic:**
The Perfect Prioritization Algorithm identifies the 2-3 operational changes that unlock 80% of growth potential through sophisticated multi-dimensional scoring:

**Step 1: Domain Triage & Agent Activation**
```javascript
// Triage scoring determines agent activation
if domain_score >= 4.5: priority_level = "CRITICAL", agent_activation = "REQUIRED"
elif domain_score >= 4.0: priority_level = "HIGH", agent_activation = "REQUIRED"  
elif domain_score >= 3.5: priority_level = "MODERATE", agent_activation = "CONDITIONAL"
else: priority_level = "HEALTHY", agent_activation = "NOT_REQUIRED"

// Mandatory agent combinations for interdependent domains
if strategy_score >= 4.0: activate_agents = ["Strategy", "People", "Change_Management"]
if revenue_score >= 4.0 AND customer_score >= 4.0: 
    activate_agents = ["Revenue", "Customer_Experience", "Customer_Success"]
```

**Step 2: Growth Impact Weighting**
```javascript
growth_impact = (
    revenue_impact_potential * 0.30 +
    efficiency_gain_potential * 0.25 + 
    competitive_advantage_creation * 0.25 +
    strategic_alignment_improvement * 0.20
)

// Dynamic weighting by company stage
if company_stage == "early_growth" (£1M-£5M): revenue_impact_weight = 0.40
elif company_stage == "scaling" (£5M-£20M): efficiency_weight = 0.30
elif company_stage == "established" (£20M+): competitive_advantage_weight = 0.30
```

**Step 3: Implementation Feasibility Assessment**
```javascript
feasibility_score = (
    resource_availability * 0.25 +
    organizational_readiness * 0.25 +
    implementation_complexity * 0.20 +
    timeline_achievability * 0.15 +
    change_management_capacity * 0.15
)

// Feasibility modifiers for constraints
if people_score >= 4.0: organizational_readiness *= 0.8
if finance_score >= 4.0: resource_availability *= 0.7
if change_management_score >= 4.0: change_management_capacity *= 0.6
```

**Step 4: Cross-Domain Dependency Analysis**
```javascript
// Strategic alignment issues amplify all other domains
if strategy_score >= 4.0: all_other_domains_impact *= 1.3

// Technology bottlenecks constrain multiple domains  
if technology_score >= 4.0:
    operations_efficiency_potential *= 0.8
    revenue_system_potential *= 0.8

// Synergy bonuses for coordinated improvements
if revenue_activated AND customer_experience_activated: combined_impact *= 1.2
if operations_activated AND technology_activated: efficiency_potential *= 1.3
```

**Final Prioritization Formula:**
```javascript
priority_score = (
    growth_impact_score * 0.40 +
    implementation_feasibility * 0.35 +
    cross_domain_synergy_bonus * 0.15 +
    urgency_multiplier * 0.10
)

// Urgency multipliers based on business context
urgency_multiplier = {
    cash_flow_issues: 1.5x,
    competitive_threat: 1.3x,
    growth_stagnation: 1.2x,
    normal_operations: 1.0x
}
```

**Algorithm Validation & Learning Loop:**
- Track correlation between priority recommendations and actual growth outcomes
- Target 70% correlation between priority_score and actual business impact
- Monthly algorithm review with weight adjustments based on success data
- A/B testing of algorithm changes on assessment subsets

## Assessment Questions Database & Branching Logic

**Question Structure:**
- **12 Specialist Domains** with 15-25 questions each (180+ total questions)
- **Scoring System:** 1-5 scale (1-2: Low concern, 3: Neutral, 4-5: High concern triggering agent activation)
- **Industry-Specific Branching:** Regulated vs non-regulated, B2B vs B2C, manufacturing vs services
- **Scale-Based Branching:** Team size >50, revenue >£10M, rapid growth >50% headcount

**Branching Logic Architecture:**
```javascript
// Industry-specific question sets
if (company.industry.regulatoryClassification === 'heavily-regulated') {
    questions.push(...regulatoryComplianceQuestions);
    questions.push(...regulatoryStrategyIntegrationQuestions);
}

if (company.businessModel === 'b2b-saas') {
    questions.push(...customerSuccessQuestions);
    questions.push(...churnPreventionQuestions);
}

// Scale-based question activation
if (company.size.employees > 50) {
    questions.push(...middleManagementEffectivenessQuestions);
}

// Follow-up question logic
if (domainScore.strategy >= 4.0) {
    followUpQuestions.push({
        question: "What specific challenges prevent clear vision communication?",
        trigger: "vision_clarity_score >= 4"
    });
}
```

**Question Database Schema:**
```typescript
interface QuestionDatabase {
    domains: {
        [domainKey: string]: {
            coreQuestions: Question[];
            industryBranching: {
                [industryType: string]: Question[];
            };
            scaleBranching: {
                [scaleType: string]: Question[];
            };
            followUpLogic: FollowUpRule[];
        }
    };
}

interface Question {
    questionId: string;
    text: string;
    responseOptions: ResponseOption[];
    scoringWeights: number[];
    criticalityLevel: 'standard' | 'high' | 'critical';
}

interface FollowUpRule {
    triggerId: string;
    condition: string; // e.g., "score >= 4.0"
    followUpQuestions: Question[];
    priority: 'critical' | 'high' | 'medium';
}
```

**Dynamic Question Generation:**
- Real-time question set assembly based on company profile and industry
- Adaptive questioning based on previous responses
- Smart follow-up generation when responses indicate high-concern areas
- Question flow optimization to reduce assessment time while maintaining accuracy

## Agent Personas Database & UI Integration

**Agent Architecture:**
- **12 Specialist Agents** with distinct professional personas and communication styles
- **Agent Attribution System** for client-facing credibility and trust building
- **UI Personality Framework** for consistent agent representation across touchpoints
- **Email Integration** with agent signatures and personalized communications

**Agent Database Schema:**
```typescript
interface AgentPersona {
    agentId: string;
    name: string;
    title: string;
    professionalBackground: {
        previousRoles: string[];
        experience: string;
        specialization: string;
        industryFocus: string[];
        credentials: string[];
    };
    communicationStyle: {
        tone: 'analytical' | 'strategic' | 'practical' | 'technical';
        approach: string;
        keyPhrase: string;
        writingStyle: WritingStyleRules;
    };
    expertiseFramework: {
        coreCompetencies: string[];
        analysisMethodology: string[];
        diagnosticQuestions: string[];
    };
    promptEngineering: {
        systemPrompt: string;
        outputTemplate: string;
        analysisApproach: string[];
    };
    uiRepresentation: {
        avatar: string;
        color: string;
        icon: string;
        professionalPhoto: string;
    };
}
```

**Agent Activation & Coordination:**
```javascript
// Agent selection based on domain scores and mandatory combinations
const activatedAgents = selectAgents(domainScores, businessContext);

// Agent coordination phases
const agentPipeline = {
    phase1: {
        type: 'parallel_analysis',
        duration: '20-30 minutes',
        agents: activatedAgents,
        outputRequirements: ['confidence_level', 'impact_assessment', 'dependencies']
    },
    phase2: {
        type: 'cross_agent_collaboration', 
        duration: '15-30 minutes',
        process: 'sequential_cross_referencing',
        outputRequirements: ['synergies', 'conflicts', 'implementation_dependencies']
    },
    phase3: {
        type: 'synthesis_prioritization',
        duration: '10-15 minutes',
        processor: 'perfect_prioritization_algorithm',
        output: 'unified_priority_recommendations'
    }
};
```

**UI Personality Framework:**
```typescript
interface AgentUIIntegration {
    reportAttribution: {
        format: "Analysis by {name}, {title}";
        credentialDisplay: boolean;
        photoDisplay: boolean;
    };
    emailPersonalization: {
        signature: string;
        communicationStyle: AgentCommunicationStyle;
        personalizedGreeting: boolean;
    };
    progressTracking: {
        agentStatus: 'analyzing' | 'collaborating' | 'completed';
        progressIndicator: string;
        estimatedCompletion: Date;
    };
    clientFacingElements: {
        expertiseHighlights: string[];
        credibilityIndicators: string[];
        analysisApproach: string;
    };
}
```

**Cross-Agent Collaboration Patterns:**
- **Strategic Foundation Agents:** Alexandra (Strategy) + Marcus (Finance) + Rachel (People)
- **Operations Optimization Cluster:** David (Operations) + Kevin (Technology) + Robert (Supply Chain)
- **Growth Engine Cluster:** Sarah (Revenue) + Lisa (Customer Experience) + Jennifer (Customer Success)
- **Enablement & Risk Cluster:** Amanda (Risk) + Michael (Partnerships) + James (Change Management)

## Quality Gates & Validation System

**Multi-Tier Quality Assurance Architecture:**
- **Agent Confidence Thresholds** with automatic validation triggers
- **Cross-Agent Consistency Validation** for recommendation conflicts
- **Human QA Integration** for edge cases and low-confidence scenarios
- **Client Validation Loop** with 48-hour feedback integration

**Quality Gate Implementation:**
```javascript
// Gate 1: Individual Agent Analysis Quality
const validateAgentOutput = (agentAnalysis) => {
    if (agentAnalysis.confidence_level >= 8) return "AUTO_APPROVE";
    else if (agentAnalysis.confidence_level >= 6) return "HUMAN_REVIEW_RECOMMENDED";
    else if (agentAnalysis.confidence_level >= 4) return "HUMAN_REVIEW_REQUIRED";
    else return "RE_ANALYSIS_REQUIRED";
};

// Gate 2: Cross-Agent Consistency Validation
const validateConsistency = (allAgentOutputs) => {
    const conflicts = detectRecommendationConflicts(allAgentOutputs);
    const missingDeps = detectMissingDependencies(allAgentOutputs);
    const timelineConflicts = detectTimelineConflicts(allAgentOutputs);
    
    const consistencyScore = -(conflicts.length * 2) - (missingDeps.length * 1) - (timelineConflicts.length * 1.5);
    
    if (consistencyScore < -5) return "REQUIRES_HUMAN_REVIEW";
    else if (consistencyScore < -2) return "MINOR_INCONSISTENCIES";
    else return "CONSISTENT_ANALYSIS";
};

// Gate 3: Perfect Prioritization Validation
const validatePrioritization = (priorities, organizationalCapacity) => {
    return {
        feasibilityCheck: priorities.every(p => p.feasibilityScore >= 6),
        capacityCheck: calculateTotalEffort(priorities) <= organizationalCapacity,
        impactCheck: calculateTotalImpact(priorities) >= (totalIdentifiedOpportunity * 0.8)
    };
};
```

**Human QA Integration Points:**
```typescript
interface QualityAssuranceSystem {
    triggerConditions: {
        lowConfidence: 'confidence_level < 6';
        crossAgentConflicts: 'recommendation_conflicts > 2';
        edgeCaseDetection: 'business_model === "complex" || regulatory_requirements === "high"';
        clientEscalation: 'client_satisfaction_risk === "high"';
    };
    qaTiers: {
        automated: AutomatedQualityChecks;
        analyst: HumanAnalystReview;
        founder: FounderEscalation;
    };
    slaManagement: {
        maxFounderTime: '4 hours per assessment';
        escalationTimeout: '2 hours from trigger';
        overrideCapability: boolean;
    };
}
```

**Client Validation & Feedback Integration:**
```javascript
// 48-Hour Validation Window Processing
const processClientValidation = (validationResponse, agentOutputs) => {
    const modifications = [];
    
    // Priority adjustment handling
    if (validationResponse.priority_feedback.some(p => p.client_agreement === "DISAGREE")) {
        modifications.push({
            type: 'priority_adjustment',
            action: 'adjust_priorities_based_on_client_reasoning',
            maintains_algorithm_integrity: true
        });
    }
    
    // Additional context integration
    validationResponse.additional_context?.forEach(context => {
        modifications.push({
            type: 'context_integration',
            impact: 'adjust_implementation_approach',
            timeline_adjustment: calculateTimelineImpact(context)
        });
    });
    
    return modifications;
};
```

**Confidence Threshold Management:**
- **Confidence Level 8+:** Auto-approve with accelerated delivery
- **Confidence Level 6-7:** Human review recommended, standard timeline
- **Confidence Level 4-5:** Human review required, potential timeline extension
- **Confidence Level <4:** Re-analysis required, timeline pause

## Timeline Management & 72-Hour Delivery Pipeline

**Standard 72-Hour Delivery Pipeline:**
```
Hour 0: Assessment submission and payment confirmation
Hour 1-2: Complete agent analysis pipeline (45-120 minutes total processing)
Hour 24: Executive summary delivery (22+ hour buffer for quality assurance)
Hour 48: Detailed analysis and validation request (46+ hour buffer)
Hour 72: Implementation accelerator kits (70+ hour buffer)
```

**Pipeline Architecture:**
```javascript
const deliveryPipeline = {
    stage1_executive_summary: {
        triggerTime: 'hour_24',
        dependencies: ['agent_analysis_complete', 'quality_gates_passed'],
        deliverables: ['executive_summary', 'priority_overview', 'quick_wins'],
        bufferTime: '22+ hours',
        fallbackStrategy: 'partial_analysis_delivery'
    },
    stage2_detailed_analysis: {
        triggerTime: 'hour_48', 
        dependencies: ['stage1_complete', 'client_engagement_confirmed'],
        deliverables: ['detailed_agent_reports', 'validation_forms', 'implementation_roadmap'],
        bufferTime: '46+ hours',
        clientInteraction: 'validation_request'
    },
    stage3_implementation_kits: {
        triggerTime: 'hour_72',
        dependencies: ['client_validation_processed', 'final_prioritization_complete'],
        deliverables: ['implementation_accelerator_kits', 'template_library', 'monitoring_frameworks'],
        bufferTime: '70+ hours',
        customization: 'client_feedback_integrated'
    }
};
```

**Timeline Control System:**
```typescript
interface TimelineManager {
    slaTracking: {
        commitmentBuffer: number; // Hours added to base timeline
        riskFactors: {
            complex_business_model: 4; // +4 hours
            regulated_industry: 6;     // +6 hours  
            large_organization: 4;     // +4 hours
            first_time_assessment: 2;  // +2 hours
        };
        maxCommitment: 84; // Never exceed 84 hours (72 + 12 hour max buffer)
    };
    pauseTriggers: {
        critical_clarifications: 'immediate_pause';
        quality_gate_failures: 'conditional_pause';
        multiple_high_priority_gaps: 'pause_if_3_plus_gaps';
    };
    recoveryProcedures: {
        level1_automated: '0-1 hour - retry with adjusted parameters';
        level2_enhanced: '1-4 hours - human QA analyst activation';  
        level3_emergency: '4+ hours - founder escalation protocol';
    };
}
```

**Timeline Pause & Resume Logic:**
```javascript
const evaluateTimelinePause = (clarificationPriority, businessContext) => {
    if (clarificationPriority === "CRITICAL") return {pause: true, reason: "Critical data gaps"};
    if (clarificationPriority === "HIGH" && businessContext.regulated_industry) 
        return {pause: true, reason: "Regulatory compliance clarification needed"};
    if (criticalGaps.length >= 3) 
        return {pause: true, reason: "Multiple high-priority clarifications needed"};
    return {pause: false};
};

const calculateResumeTimeline = (pauseDuration, originalTimeline) => {
    if (pauseDuration <= 4) return originalTimeline; // No adjustment
    if (pauseDuration <= 24) return originalTimeline + (pauseDuration * 0.5);
    return originalTimeline + (pauseDuration * 0.8); // Major adjustment
};
```

**SLA Management & Recovery:**
```javascript
const slaRecoveryProtocol = {
    at_risk_threshold: '90% of commitment time used',
    actions: [
        'activate_sla_recovery_mode',
        'assign_additional_qa_resources',
        'simplify_analysis_scope_if_necessary', 
        'prepare_client_communication_for_minor_delay',
        'activate_founder_escalation_protocol'
    ],
    exceeded_protocol: [
        'immediate_client_notification_with_apology',
        'rush_delivery_of_available_analysis',
        'commit_to_full_analysis_within_24_hours',
        'provide_service_credit_or_discount',
        'post_mortem_analysis_for_process_improvement'
    ]
};
```

**Client Communication During Timeline Events:**
- **Immediate (within 1 hour of pause):** Email notification with expected resolution time
- **Progress Updates (every 8 hours during pause):** Status updates with revised timeline estimates
- **Resolution (upon clarification receipt):** Timeline resume confirmation with updated delivery schedule

## Content Integration & Dynamic Report Generation

**Report Template System:**
- **Agent-Specific Templates** with consistent formatting and attribution
- **Dynamic Content Insertion** based on agent analysis and client context
- **Implementation Accelerator Kits** with customizable templates and frameworks
- **Email Integration** with agent personas and professional signatures

**Dynamic Content Architecture:**
```typescript
interface ReportGenerationSystem {
    templateEngine: {
        agentReportTemplates: Map<AgentId, ReportTemplate>;
        executiveSummaryTemplate: SummaryTemplate;
        implementationKitTemplates: ImplementationTemplate[];
        emailTemplates: EmailTemplate[];
    };
    contentProcessing: {
        dynamicInsertion: DynamicContentProcessor;
        agentAttribution: AgentAttributionProcessor;
        clientPersonalization: PersonalizationEngine;
        validationFormGeneration: ValidationFormGenerator;
    };
    deliveryFormats: {
        pdf: PDFGenerator;
        interactive: InteractiveReportGenerator; 
        email: EmailContentGenerator;
        implementationKits: ImplementationKitGenerator;
    };
}
```

**Report Generation Pipeline:**
```javascript
const generateClientDeliverables = async (agentOutputs, clientValidation, timeline) => {
    // Stage 1: Executive Summary (24 hours)
    const executiveSummary = {
        template: 'executive_summary_template',
        content: synthesizeAgentInsights(agentOutputs),
        attribution: generateAgentAttributions(agentOutputs),
        quickWins: extractQuickWins(agentOutputs),
        priorityOverview: algorithmPriorities.slice(0, 3)
    };
    
    // Stage 2: Detailed Analysis (48 hours)  
    const detailedAnalysis = {
        agentReports: agentOutputs.map(output => ({
            agentPersona: getAgentPersona(output.agentId),
            analysis: formatAgentAnalysis(output),
            recommendations: prioritizeRecommendations(output),
            implementation: generateImplementationGuidance(output)
        })),
        validationForms: generateValidationForms(algorithmPriorities),
        crossDomainSynergies: identifySynergies(agentOutputs)
    };
    
    // Stage 3: Implementation Kits (72 hours)
    const implementationKits = await generateImplementationKits(
        finalPriorities, 
        clientValidation, 
        agentOutputs
    );
    
    return {executiveSummary, detailedAnalysis, implementationKits};
};
```

**Agent Attribution & Credibility System:**
```javascript
const generateAgentAttribution = (agentOutput) => {
    const agent = getAgentPersona(agentOutput.agentId);
    return {
        attribution: `Analysis by ${agent.name}, ${agent.title}`,
        credentials: agent.professionalBackground.credentials,
        expertise: agent.expertiseFramework.coreCompetencies,
        photo: agent.uiRepresentation.professionalPhoto,
        signature: generateEmailSignature(agent),
        analysisApproach: agent.communicationStyle.approach
    };
};
```

**Implementation Accelerator Kit Generation:**
```typescript
interface ImplementationKit {
    priority: PriorityRecommendation;
    acceleratorComponents: {
        implementationRoadmap: RoadmapTemplate;
        templateLibrary: Template[];
        monitoringFrameworks: MonitoringTemplate[];
        checklistsAndTools: ImplementationTool[];
        successMetrics: MetricsFramework;
    };
    customization: {
        clientSpecificContext: string;
        resourceConstraints: ResourceConstraint[];
        timelineAdjustments: TimelineAdjustment[];
        industrySpecificGuidance: IndustryGuidance;
    };
}

const generateImplementationKits = async (priorities, clientValidation) => {
    return Promise.all(priorities.map(async (priority) => ({
        priority,
        roadmap: await generateCustomRoadmap(priority, clientValidation),
        templates: await selectRelevantTemplates(priority),
        monitoring: await generateMonitoringFramework(priority),
        tools: await selectImplementationTools(priority),
        metrics: await defineSuccessMetrics(priority)
    })));
};
```

**Email Integration & Personalization:**
```javascript
const generatePersonalizedEmails = (deliverables, activatedAgents, clientContext) => {
    return {
        stage1_delivery: {
            from: getLeadAgent(activatedAgents),
            subject: `ScaleMap Analysis Complete: ${clientContext.primaryChallenge} Solutions Identified`,
            content: generateEmailContent('executive_summary_delivery', deliverables.executiveSummary),
            attachments: [deliverables.executiveSummary.pdf],
            agentSignatures: activatedAgents.map(generateAgentSignature)
        },
        stage2_validation: {
            from: getLeadAgent(activatedAgents),
            subject: `Validation Request: Confirm Your Priority Recommendations`,
            content: generateValidationEmailContent(deliverables.detailedAnalysis),
            attachments: [deliverables.detailedAnalysis.pdf, deliverables.validationForms],
            validationDeadline: addHours(now(), 48)
        },
        stage3_implementation: {
            from: getLeadAgent(activatedAgents),
            subject: `Implementation Accelerator Kits: Transform Your Growth Strategy`,
            content: generateImplementationEmailContent(deliverables.implementationKits),
            attachments: deliverables.implementationKits.map(kit => kit.archive),
            followUpSchedule: generateFollowUpSchedule(clientContext)
        }
    };
};
```

**Validation Form Integration:**
- Dynamic form generation based on Priority 1, 2, 3 recommendations
- Client agreement/disagreement tracking with reasoning capture
- Additional context integration fields
- Resource constraint validation and timeline adjustment requests

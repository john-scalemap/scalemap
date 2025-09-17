# ScaleMap Business Logic Requirements

## Overview

This document defines the core business logic that powers ScaleMap's Perfect Prioritization Algorithm, agent coordination, and quality assurance systems. These rules orchestrate the intelligent analysis pipeline from assessment triage through final deliverable generation.

**Core Logic Systems:**
- Perfect Prioritization Algorithm for growth impact analysis
- Agent activation and coordination rules
- Quality assurance and confidence thresholds
- Timeline management and client interaction logic
- Clarification request triggers and handling

---

## Perfect Prioritization Algorithm

### Core Algorithm Logic

The Perfect Prioritization Algorithm identifies the 2-3 operational changes that unlock 80% of growth potential by combining domain-specific analysis with cross-impact modeling and implementation feasibility assessment.

#### **Step 1: Domain Triage & Agent Activation**

**Triage Scoring Logic:**
```
For each domain (1-12):
  domain_score = weighted_average(question_scores)
  
  if domain_score >= 4.5:
    priority_level = "CRITICAL" 
    agent_activation = "REQUIRED"
    
  elif domain_score >= 4.0:
    priority_level = "HIGH"
    agent_activation = "REQUIRED"
    
  elif domain_score >= 3.5:
    priority_level = "MODERATE" 
    agent_activation = "CONDITIONAL"
    
  else:
    priority_level = "HEALTHY"
    agent_activation = "NOT_REQUIRED"
```

**Agent Activation Rules:**
- **Minimum Activation:** 3 agents (even if only 2 domains score 4+)
- **Maximum Activation:** 7 agents (cost optimization limit)
- **Typical Activation:** 4-5 agents based on interdependencies

**Mandatory Agent Combinations:**
```
if strategy_score >= 4.0:
    activate_agents = ["Strategy", "People", "Change_Management"]
    # Strategy issues always require people and implementation support

if finance_score >= 4.0:
    activate_agents.add("Finance")
    # Financial issues affect all other domain implementations
    
if revenue_score >= 4.0 AND customer_score >= 4.0:
    activate_agents = ["Revenue", "Customer_Experience", "Customer_Success"]
    # Revenue issues often interconnected with customer experience

if operations_score >= 4.0 AND technology_score >= 4.0:
    activate_agents = ["Operations", "Technology"]
    # Operations and technology bottlenecks often interrelated
```

#### **Step 2: Growth Impact Weighting**

Each identified issue is scored across four dimensions:

**Growth Impact Score (1-10):**
```
growth_impact = (
    revenue_impact_potential * 0.30 +
    efficiency_gain_potential * 0.25 + 
    competitive_advantage_creation * 0.25 +
    strategic_alignment_improvement * 0.20
)

Where:
- revenue_impact_potential: Direct/indirect revenue growth potential
- efficiency_gain_potential: Cost reduction and operational efficiency
- competitive_advantage_creation: Sustainable differentiation potential  
- strategic_alignment_improvement: Strategic coherence enhancement
```

**Impact Weighting by Business Context:**
```
if company_stage == "early_growth" (£1M-£5M):
    revenue_impact_weight = 0.40
    efficiency_weight = 0.20
    
elif company_stage == "scaling" (£5M-£20M):
    revenue_impact_weight = 0.30
    efficiency_weight = 0.30
    
elif company_stage == "established" (£20M+):
    efficiency_weight = 0.35
    competitive_advantage_weight = 0.30
```

#### **Step 3: Implementation Feasibility Assessment**

**Feasibility Score (1-10):**
```
feasibility_score = (
    resource_availability * 0.25 +
    organizational_readiness * 0.25 +
    implementation_complexity * 0.20 +
    timeline_achievability * 0.15 +
    change_management_capacity * 0.15
)

Where lower implementation_complexity scores higher (inverted)
```

**Feasibility Modifiers:**
```
if people_score >= 4.0:
    organizational_readiness *= 0.8  # People issues reduce readiness
    
if finance_score >= 4.0:
    resource_availability *= 0.7    # Financial constraints limit resources
    
if change_management_score >= 4.0:
    change_management_capacity *= 0.6  # Change capacity issues
```

#### **Step 4: Cross-Domain Dependency Analysis**

**Dependency Impact Multipliers:**
```
# Strategic alignment issues amplify all other domains
if strategy_score >= 4.0:
    all_other_domains_impact *= 1.3
    
# Financial issues limit implementation capacity
if finance_score >= 4.0:
    all_implementation_feasibility *= 0.8
    
# People issues affect all transformation efforts  
if people_score >= 4.0:
    change_management_capacity *= 0.7
    implementation_timeline *= 1.4
    
# Technology bottlenecks constrain multiple domains
if technology_score >= 4.0:
    operations_efficiency_potential *= 0.8
    revenue_system_potential *= 0.8
```

**Cross-Domain Synergy Bonuses:**
```
# Revenue + Customer Experience synergy
if revenue_activated AND customer_experience_activated:
    combined_impact *= 1.2
    
# Operations + Technology synergy  
if operations_activated AND technology_activated:
    efficiency_potential *= 1.3
    
# Strategy + People + Change Management synergy
if strategy_activated AND people_activated AND change_activated:
    implementation_success_probability *= 1.4
```

#### **Step 5: Perfect Prioritization Calculation**

**Priority Score Formula:**
```
priority_score = (
    growth_impact_score * 0.40 +
    implementation_feasibility * 0.35 +
    cross_domain_synergy_bonus * 0.15 +
    urgency_multiplier * 0.10
)

urgency_multiplier = based on business context:
- Cash flow issues: 1.5x
- Competitive threat: 1.3x  
- Growth stagnation: 1.2x
- Normal operations: 1.0x
```

**Final Prioritization Logic:**
```
1. Sort all identified issues by priority_score (descending)
2. Select top 2-3 issues that:
   - Combined implementation effort < organizational_capacity
   - No conflicting implementation requirements
   - Address at least 80% of total identified growth_impact_potential
3. Validate selection doesn't exceed change_management_capacity
```

### Algorithm Validation & Tuning

**Success Correlation Tracking:**
```
For each assessment delivered:
- Track client implementation of Priority 1, 2, 3 recommendations
- Measure actual growth outcomes at 30, 60, 90 days
- Calculate correlation between priority_score and actual_impact
- Adjust algorithm weights based on correlation analysis

Target: 70% correlation between priority recommendations and growth outcomes
```

**Algorithm Learning Loop:**
```
Monthly algorithm review:
1. Analyze correlation data across all assessments
2. Identify systematic over/under-weighting patterns  
3. Adjust impact weights and feasibility modifiers
4. A/B test algorithm changes on subset of assessments
5. Roll out improvements to full algorithm
```

---

## Agent Coordination & Quality Logic

### Agent Activation Decision Tree

**Primary Agent Selection:**
```python
def select_agents(domain_scores, business_context):
    required_agents = []
    
    # Always activate agents for scores 4.0+
    for domain, score in domain_scores.items():
        if score >= 4.0:
            required_agents.append(get_agent(domain))
    
    # Ensure minimum 3 agents for comprehensive analysis
    if len(required_agents) < 3:
        # Activate highest scoring remaining domains
        remaining_domains = sorted_remaining_domains(domain_scores)
        for domain in remaining_domains[:3-len(required_agents)]:
            required_agents.append(get_agent(domain))
    
    # Add mandatory combinations
    required_agents = apply_mandatory_combinations(required_agents, domain_scores)
    
    # Cap at maximum 7 agents for cost optimization
    if len(required_agents) > 7:
        required_agents = select_highest_impact_agents(required_agents, 7)
        
    return required_agents
```

### Agent Coordination Rules

**Sequential Analysis Phases:**
```
Phase 1: Individual Domain Analysis (Parallel)
- Each activated agent: 20-30 minutes processing time
- 3-5 agents running in parallel = 20-30 minutes total
- Output: Domain assessment with confidence scores

Phase 2: Cross-Agent Collaboration (Sequential)
- Agent cross-referencing: 5-10 minutes per agent
- Total collaboration window: 15-30 minutes maximum
- Identify cross-domain synergies and conflicts

Phase 3: Synthesis & Prioritization (Orchestrator)
- Perfect Prioritization Algorithm processing: 5-15 minutes
- Generate unified priority recommendations: 10-15 minutes
- Resolve any agent disagreements through weighted analysis

Total Agent Processing Time: 45-75 minutes
Maximum with retries/quality checks: 90-120 minutes
```

**Agent Communication Protocol:**
```
Agent outputs must include:
- confidence_level: 1-10 (agent's confidence in analysis)
- impact_assessment: growth impact potential (1-10)  
- implementation_complexity: difficulty assessment (1-10)
- dependencies: list of other domains that affect this domain
- synergies: opportunities for cross-domain optimization
- quick_wins: 0-30 day improvement opportunities
- strategic_initiatives: 90+ day transformation projects
```

### Quality Assurance Logic

**Agent Confidence Thresholds:**
```python
def validate_agent_output(agent_analysis):
    if agent_analysis.confidence_level >= 8:
        validation_status = "AUTO_APPROVE"
        
    elif agent_analysis.confidence_level >= 6:
        validation_status = "HUMAN_REVIEW_RECOMMENDED"
        
    elif agent_analysis.confidence_level >= 4:
        validation_status = "HUMAN_REVIEW_REQUIRED" 
        
    else:
        validation_status = "RE_ANALYSIS_REQUIRED"
        trigger_re_analysis(agent_analysis.domain)
        
    return validation_status
```

**Cross-Agent Consistency Validation:**
```python
def validate_cross_agent_consistency(all_agent_outputs):
    consistency_score = 0
    
    # Check for conflicting recommendations
    conflicts = detect_recommendation_conflicts(all_agent_outputs)
    if len(conflicts) > 0:
        consistency_score -= len(conflicts) * 2
        
    # Check for missing dependencies
    missing_deps = detect_missing_dependencies(all_agent_outputs)  
    if len(missing_deps) > 0:
        consistency_score -= len(missing_deps) * 1
        
    # Check for unrealistic timelines
    timeline_conflicts = detect_timeline_conflicts(all_agent_outputs)
    if len(timeline_conflicts) > 0:
        consistency_score -= len(timeline_conflicts) * 1.5
        
    if consistency_score < -5:
        return "REQUIRES_HUMAN_REVIEW"
    elif consistency_score < -2:
        return "MINOR_INCONSISTENCIES" 
    else:
        return "CONSISTENT_ANALYSIS"
```

**Quality Gates for Delivery:**
```
Gate 1: Individual Agent Analysis Quality
- All agents achieve confidence_level >= 6
- No critical analysis gaps identified
- Domain coverage complete for activated agents

Gate 2: Cross-Agent Consistency  
- No major recommendation conflicts
- Dependencies properly identified and addressed
- Implementation timelines are realistic and non-conflicting

Gate 3: Perfect Prioritization Validation
- Priority recommendations pass feasibility checks
- Combined implementation effort within organizational capacity  
- Growth impact potential >= 80% of total identified opportunity

Gate 4: Human QA Review (if triggered)
- Founder review for confidence_level < 8 or consistency issues
- Maximum 4 hours founder time per assessment
- Override capability for edge cases
```

---

## Clarification Request Logic

### Automatic Clarification Triggers

**Data Sufficiency Analysis:**
```python
def assess_data_sufficiency(domain, assessment_responses, documents):
    sufficiency_score = 0
    critical_gaps = []
    
    # Check question completion rate
    completion_rate = calculate_completion_rate(domain, assessment_responses)
    if completion_rate < 0.8:
        sufficiency_score -= 3
        critical_gaps.append("incomplete_assessment")
    
    # Check for contradictory responses  
    contradictions = detect_contradictions(assessment_responses)
    if len(contradictions) > 0:
        sufficiency_score -= len(contradictions) * 2
        critical_gaps.extend(contradictions)
    
    # Check document support for claims
    document_support = assess_document_support(assessment_responses, documents)
    if document_support < 0.6:
        sufficiency_score -= 2
        critical_gaps.append("insufficient_documentation")
        
    return sufficiency_score, critical_gaps
```

**Clarification Priority Rules:**
```
CRITICAL (Pause Timeline):
- Financial data inconsistencies that affect investment analysis
- Strategic direction contradictions from leadership team
- Regulatory compliance gaps in regulated industries
- Customer satisfaction data that conflicts with growth claims

HIGH (Request but Continue):  
- Missing operational metrics for efficiency analysis
- Incomplete organizational structure information
- Technology architecture details for scalability assessment
- Market positioning data for competitive analysis

MEDIUM (Nice to Have):
- Additional customer feedback examples  
- Extended financial historical data
- Detailed process documentation
- Industry benchmark comparisons
```

### Clarification Request Generation

**Smart Question Generation:**
```python
def generate_clarification_questions(domain, critical_gaps, agent_analysis):
    questions = []
    
    for gap in critical_gaps:
        if gap == "incomplete_assessment":
            missing_questions = identify_missing_questions(domain, assessment_responses)
            questions.extend(prioritize_questions(missing_questions, agent_analysis))
            
        elif gap == "contradictory_responses":
            contradiction_pairs = identify_contradictions(assessment_responses)
            questions.extend(resolve_contradiction_questions(contradiction_pairs))
            
        elif gap == "insufficient_documentation": 
            needed_docs = identify_needed_documents(domain, agent_analysis)
            questions.extend(document_request_questions(needed_docs))
            
    return questions[:5]  # Limit to 5 questions max to avoid overwhelming client
```

**Clarification Templates by Domain:**
```
Strategy Domain:
- "Your assessment indicates [X], but document [Y] suggests [Z]. Can you clarify...?"
- "To better assess strategic alignment, can you provide examples of..."
- "The leadership team responses vary on [topic]. What is the agreed position on...?"

Financial Domain:  
- "Your cash flow projections show [X], but revenue data indicates [Y]. Can you explain..."
- "To properly assess capital efficiency, we need clarification on..."
- "The financial controls description conflicts with [document]. Can you provide..."

Operations Domain:
- "You mentioned process [X] takes [Y] time, but industry benchmarks suggest [Z]. Can you..."
- "To assess scalability, can you provide more details about..."
- "The operational bottleneck description needs clarification around..."
```

---

## Timeline Management Logic

### Timeline Control System

**Standard 72-Hour Pipeline:**
```
Hour 0: Assessment submission and payment confirmation
Hour 1-2: Complete agent analysis pipeline (45-120 minutes total processing)
Hour 24: Executive summary delivery (22+ hour buffer for quality assurance)
Hour 48: Detailed analysis and validation request (46+ hour buffer)  
Hour 72: Implementation accelerator kits (70+ hour buffer)

Note: Agent processing completes within 1-2 hours, leaving substantial buffer 
time for quality assurance, human review, and delivery preparation.
```

**Timeline Pause Triggers:**
```python
def evaluate_timeline_pause(clarification_priority, business_context):
    pause_decision = False
    
    if clarification_priority == "CRITICAL":
        pause_decision = True
        pause_reason = "Critical data gaps identified"
        
    elif clarification_priority == "HIGH" and business_context.regulated_industry:
        pause_decision = True  
        pause_reason = "Regulatory compliance clarification needed"
        
    elif len(critical_gaps) >= 3:
        pause_decision = True
        pause_reason = "Multiple high-priority clarifications needed"
        
    return pause_decision, pause_reason
```

**Timeline Resume Logic:**
```python  
def calculate_resume_timeline(pause_duration, original_timeline, clarification_complexity):
    if pause_duration <= 4:  # 4 hours or less
        # No timeline adjustment needed
        return original_timeline
        
    elif pause_duration <= 24:  # Within 24 hours
        # Add 50% of pause time to remaining timeline
        time_adjustment = pause_duration * 0.5
        return original_timeline + time_adjustment
        
    else:  # Longer than 24 hours
        # Major timeline adjustment needed
        time_adjustment = pause_duration * 0.8  
        return original_timeline + time_adjustment
```

**Client Communication During Pauses:**
```
Immediate (within 1 hour of pause):
- Email notification explaining pause and expected resolution time
- Clear list of needed clarifications
- Timeline adjustment communication

Progress Updates (every 8 hours during pause):
- Status update on clarification progress
- Revised timeline estimates  
- Option for client to proceed with partial analysis

Resolution (upon clarification receipt):
- Timeline resume confirmation
- Updated delivery schedule
- Progress summary and next steps
```

### SLA Management

**Delivery Commitment Logic:**
```python
def calculate_delivery_commitment(base_timeline, risk_factors):
    commitment_buffer = 0
    
    # Add buffer for risk factors
    if risk_factors.complex_business_model:
        commitment_buffer += 4  # 4 hours
        
    if risk_factors.regulated_industry:
        commitment_buffer += 6  # 6 hours
        
    if risk_factors.large_organization:  # 100+ employees
        commitment_buffer += 4  # 4 hours
        
    if risk_factors.first_time_assessment:
        commitment_buffer += 2  # 2 hours
        
    # Never exceed 84 hours (72 + 12 hour max buffer)
    final_commitment = min(base_timeline + commitment_buffer, 84)
    
    return final_commitment
```

**SLA Recovery Procedures:**
```
If timeline at risk (>90% of commitment used):
1. Activate SLA recovery mode
2. Assign additional QA resources  
3. Simplify analysis scope if necessary
4. Prepare client communication for minor delay
5. Activate founder escalation protocol

If timeline exceeded:
1. Immediate client notification with apology
2. Rush delivery of available analysis
3. Commit to full analysis within 24 hours
4. Provide service credit or discount
5. Post-mortem analysis for process improvement
```

---

## Validation & Feedback Integration Logic

### Client Validation System

**48-Hour Validation Window:**
```python
def process_client_validation(validation_response, agent_outputs):
    modifications_needed = []
    
    for priority_item in validation_response.priority_feedback:
        if priority_item.client_agreement == "DISAGREE":
            # Client disagrees with priority ranking
            modifications_needed.append({
                'type': 'priority_adjustment',
                'item': priority_item,
                'reason': priority_item.client_reasoning
            })
            
        elif priority_item.additional_context:
            # Client provided additional context
            modifications_needed.append({
                'type': 'context_integration',
                'item': priority_item,
                'context': priority_item.additional_context  
            })
    
    return modifications_needed
```

**Validation Integration Rules:**
```
CLIENT_PRIORITY_OVERRIDE:
- If client strongly disagrees with Priority #1 recommendation
- Adjust Priority #1 to Priority #2, integrate client reasoning
- Maintain algorithm integrity by noting override in analysis

ADDITIONAL_CONTEXT_INTEGRATION:
- Integrate client context into implementation recommendations
- Adjust timelines based on client capacity constraints
- Modify implementation approach based on client preferences

RESOURCE_CONSTRAINT_ADJUSTMENT:
- If client indicates resource constraints differ from assessment
- Adjust implementation complexity recommendations
- Rebalance priorities based on actual capacity
```

**Validation Response Processing:**
```python
def generate_final_recommendations(agent_outputs, client_validation, algorithm_priorities):
    final_priorities = algorithm_priorities.copy()
    
    # Process client feedback
    for modification in process_client_validation(client_validation, agent_outputs):
        if modification.type == "priority_adjustment":
            final_priorities = adjust_priorities(final_priorities, modification)
            
        elif modification.type == "context_integration":  
            final_priorities = integrate_context(final_priorities, modification)
            
    # Ensure recommendations remain actionable
    final_priorities = validate_implementation_feasibility(final_priorities)
    
    # Generate implementation accelerator kits
    implementation_kits = generate_implementation_kits(final_priorities, client_validation)
    
    return final_priorities, implementation_kits
```

---

## Error Handling & Recovery Logic

### Analysis Failure Recovery

**Agent Analysis Failure Handling:**
```python
def handle_agent_failure(failed_agent, failure_reason, hours_since_submission):
    recovery_action = None
    
    if failure_reason == "API_TIMEOUT":
        if hours_since_submission < 2:  # Still within normal processing window
            recovery_action = "RETRY_WITH_SIMPLIFIED_PROMPT"
        else:
            recovery_action = "FALLBACK_TO_BASIC_ANALYSIS"
            
    elif failure_reason == "INSUFFICIENT_DATA":
        recovery_action = "REQUEST_CRITICAL_CLARIFICATIONS"
        
    elif failure_reason == "ANALYSIS_QUALITY_TOO_LOW":
        if hours_since_submission < 4:  # Plenty of buffer time remaining
            recovery_action = "RETRY_WITH_ENHANCED_PROMPT"
        else:
            recovery_action = "HUMAN_ANALYST_BACKUP"
            
    return recovery_action
```

**Quality Failure Recovery:**
```python
def handle_quality_failure(quality_issues, hours_since_submission):
    recovery_plan = []
    
    for issue in quality_issues:
        if issue.type == "AGENT_CONFIDENCE_LOW":
            if hours_since_submission < 4:  # Plenty of buffer time
                recovery_plan.append("RE_ANALYZE_WITH_ADDITIONAL_CONTEXT")
            else:
                recovery_plan.append("HUMAN_QA_REVIEW_REQUIRED")
                
        elif issue.type == "CROSS_AGENT_INCONSISTENCY":
            recovery_plan.append("AGENT_COLLABORATION_SESSION")  # Quick 10-15 min fix
            
        elif issue.type == "RECOMMENDATION_INFEASIBLE":
            recovery_plan.append("FEASIBILITY_ADJUSTMENT_REQUIRED")
            
    return recovery_plan
```

### Business Continuity Logic

**System Failure Escalation:**
```
Level 1: Automated Recovery (0-1 hour)
- Retry failed operations with adjusted parameters
- Activate backup agent configurations  
- Use cached analysis for similar business profiles

Level 2: Enhanced Recovery (1-4 hours)  
- Activate human QA analyst for critical gaps
- Use hybrid human-AI analysis approach
- Adjust scope to ensure on-time delivery

Level 3: Emergency Protocols (4+ hours)
- Activate founder for direct client communication
- Provide partial analysis with committed completion timeline
- Implement service recovery procedures (credits/discounts)
```

This comprehensive business logic framework provides the operational intelligence needed to orchestrate ScaleMap's Perfect Prioritization Algorithm while maintaining quality, timeline commitments, and client satisfaction.
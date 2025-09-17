# ScaleMap Assessment Questions Database

## Overview

This database contains the complete question sets for ScaleMap's 12-domain operational assessment, designed to enable AI agents to identify growth bottlenecks through structured diagnostic analysis.

**Assessment Structure:**
- 12 specialist domains with 15-25 questions each
- Industry-specific branching (regulated vs non-regulated)
- Triage scoring system for agent activation
- Follow-up question logic based on responses

**Scoring System:**
- **1-2:** Low concern/strength area
- **3:** Neutral/average performance  
- **4-5:** High concern requiring agent analysis
- **Score 4+** triggers specialist agent activation for that domain

## Domain 1: Strategic Alignment & Vision

### Core Questions

**1.1 Vision Clarity & Communication**
- How clearly can your leadership team articulate your company's 3-year vision in one sentence?
  - (1) Crystal clear - everyone gives the same answer
  - (2) Mostly clear - minor variations in wording
  - (3) Somewhat clear - general alignment but different emphases
  - (4) Unclear - significant variations in interpretation
  - (5) No clear vision - leadership gives contradictory answers

**1.2 Strategic Priority Alignment**
- When making resource allocation decisions, how often do teams reference strategic priorities?
  - (1) Always - every major decision includes strategic impact analysis
  - (2) Usually - strategic considerations are standard part of decisions
  - (3) Sometimes - strategic alignment happens for bigger decisions
  - (4) Rarely - decisions made mostly on operational needs
  - (5) Never - strategic priorities don't influence day-to-day resource allocation

**1.3 Goal Cascading Effectiveness**
- How well do individual team goals connect to company-wide objectives?
  - (1) Perfect alignment - every team goal clearly traces to strategic objectives
  - (2) Strong alignment - most goals connect with clear reasoning
  - (3) Moderate alignment - connections exist but aren't always clear
  - (4) Weak alignment - some teams have goals unrelated to strategy
  - (5) No alignment - team goals set independently of strategic objectives

**1.4 Market Position Understanding**
- How accurately does your leadership team assess your competitive position?
  - (1) Highly accurate - deep market intelligence informs all strategic decisions
  - (2) Mostly accurate - good understanding with minor blind spots
  - (3) Reasonably accurate - understanding is correct but not comprehensive
  - (4) Somewhat inaccurate - significant gaps in competitive intelligence
  - (5) Highly inaccurate - leadership operates with poor market understanding

**1.5 Strategic Communication Frequency**
- How often does leadership communicate strategic updates to the organization?
  - (1) Weekly - consistent strategic context in regular communications
  - (2) Monthly - regular strategic updates with clear progress tracking
  - (3) Quarterly - strategic communication tied to business cycles
  - (4) Semi-annually - strategic updates happen but infrequently
  - (5) Annually or less - minimal strategic communication to teams

**1.6 Strategic Pivoting Capability**
- When market conditions change, how quickly can your organization adapt strategy?
  - (1) Within weeks - agile strategic planning with rapid execution
  - (2) Within 1-2 months - efficient strategic adaptation process
  - (3) Within 3-6 months - standard strategic planning cycles allow adaptation
  - (4) Within 6-12 months - slow strategic adaptation due to planning constraints
  - (5) Over 12 months - strategic planning too rigid for market adaptation

### Industry-Specific Branching

**IF Regulated Industry (Financial Services, Healthcare, Energy):**

**1.7 Regulatory Strategy Integration**
- How well does your strategic planning incorporate regulatory compliance requirements?
  - (1) Fully integrated - compliance drives strategic opportunities
  - (2) Well integrated - compliance considerations built into all strategic decisions
  - (3) Moderately integrated - compliance considered but not central to strategy
  - (4) Poorly integrated - compliance seen as separate from strategic planning
  - (5) Not integrated - regulatory requirements reactive, not strategic

**1.8 Compliance-Driven Innovation**
- How effectively does your organization turn regulatory requirements into competitive advantages?
  - (1) Expert level - compliance capabilities become market differentiators
  - (2) Advanced level - regulatory expertise creates business opportunities
  - (3) Competent level - compliance handled efficiently without strategic benefit
  - (4) Basic level - compliance managed but not leveraged strategically
  - (5) Struggling - compliance seen only as cost and constraint

### Follow-Up Question Logic

**IF Score 4+ on Vision Clarity (1.1):**
- **Follow-up:** What specific challenges prevent clear vision communication?
- **Follow-up:** How long has the organization operated without clear strategic direction?

**IF Score 4+ on Strategic Priority Alignment (1.2):**
- **Follow-up:** What drives resource allocation decisions when strategy isn't considered?
- **Follow-up:** How do conflicting priorities get resolved across departments?

## Domain 2: Financial Management & Capital Efficiency

### Core Questions

**2.1 Cash Flow Predictability**
- How accurately can you predict monthly cash flow 3 months in advance?
  - (1) Within 5% - highly predictable with robust forecasting models
  - (2) Within 10% - good predictability with minor seasonal variations
  - (3) Within 20% - reasonable accuracy but significant month-to-month variations
  - (4) Within 30% - poor predictability making planning difficult
  - (5) Cannot predict - cash flow highly volatile and unpredictable

**2.2 Financial Planning Sophistication**
- How detailed and scenario-based is your financial planning process?
  - (1) Advanced - multiple scenarios with sensitivity analysis and Monte Carlo modeling
  - (2) Sophisticated - base/optimistic/pessimistic scenarios with regular updates
  - (3) Standard - annual budgets with quarterly reviews and basic scenario planning
  - (4) Basic - simple budgets without scenario planning or regular updates
  - (5) Minimal - reactive financial management without formal planning process

**2.3 Unit Economics Understanding**
- How well does leadership understand unit economics across all business lines?
  - (1) Expert level - granular unit economics drive all business decisions
  - (2) Advanced level - strong understanding with regular optimization efforts
  - (3) Good level - basic unit economics tracked but not consistently optimized
  - (4) Limited level - unit economics understood conceptually but not tracked systematically
  - (5) Poor level - little to no understanding of true unit economics

**2.4 Capital Allocation Efficiency**
- How effectively does your organization allocate capital across growth opportunities?
  - (1) Highly effective - systematic ROI analysis drives all capital allocation
  - (2) Very effective - strong processes with occasional suboptimal decisions
  - (3) Moderately effective - reasonable processes but inconsistent execution
  - (4) Somewhat effective - ad hoc capital allocation with limited analysis
  - (5) Ineffective - capital allocation driven by politics or intuition rather than analysis

**2.5 Working Capital Management**
- How well optimized is your working capital management (inventory, receivables, payables)?
  - (1) Highly optimized - sophisticated working capital management creates competitive advantage
  - (2) Well optimized - efficient processes with regular optimization efforts
  - (3) Adequately managed - standard practices without significant inefficiencies
  - (4) Poorly managed - significant working capital tied up unnecessarily
  - (5) Very poor - working capital management creates cash flow problems

**2.6 Financial Controls & Risk Management**
- How robust are your financial controls and risk management processes?
  - (1) Enterprise-grade - comprehensive controls with automated monitoring and alerts
  - (2) Strong controls - solid processes with regular audits and improvements
  - (3) Adequate controls - basic controls in place meeting minimum requirements
  - (4) Weak controls - minimal controls creating risk exposure
  - (5) Poor controls - significant control gaps creating operational and compliance risks

**2.7 Growth Investment ROI Tracking**
- How effectively do you measure ROI on growth investments (marketing, sales, product)?
  - (1) Sophisticated tracking - granular ROI measurement with attribution modeling
  - (2) Good tracking - clear ROI metrics with regular optimization
  - (3) Basic tracking - simple ROI measurement without detailed attribution
  - (4) Limited tracking - ROI measured occasionally or at high level only
  - (5) No tracking - growth investments made without systematic ROI measurement

### Industry-Specific Branching

**IF Revenue > £10M:**

**2.8 Enterprise Financial Systems**
- How well do your financial systems support your current scale and growth plans?
  - (1) Excellent - enterprise-grade systems with full integration and automation
  - (2) Good - solid systems meeting current needs with clear upgrade path
  - (3) Adequate - systems work but have limitations affecting efficiency
  - (4) Poor - systems create bottlenecks and require significant manual work
  - (5) Inadequate - systems cannot support current operations effectively

**IF Regulated Industry:**

**2.9 Regulatory Capital Requirements**
- How effectively does your organization manage regulatory capital requirements?
  - (1) Expert management - regulatory capital optimized as competitive advantage
  - (2) Strong management - efficient compliance with minimal excess capital
  - (3) Adequate management - meets requirements but not optimized
  - (4) Struggling - difficulty meeting requirements or significant over-capitalization
  - (5) Poor management - regulatory capital issues affecting business operations

## Domain 3: Revenue Engine & Growth Systems

### Core Questions

**3.1 Revenue Growth Predictability**
- How accurately can you predict quarterly revenue 2 quarters in advance?
  - (1) Within 5% - highly predictable revenue with strong pipeline visibility
  - (2) Within 10% - good predictability with minor seasonal or market variations
  - (3) Within 15% - reasonable accuracy but some unpredictable elements
  - (4) Within 25% - poor predictability making growth planning difficult
  - (5) Cannot predict - revenue highly volatile and unpredictable

**3.2 Sales Process Optimization**
- How well optimized and documented is your sales process from lead to close?
  - (1) Highly optimized - data-driven sales process with continuous optimization
  - (2) Well optimized - clear process with regular improvements based on performance data
  - (3) Moderately optimized - documented process but limited optimization efforts
  - (4) Basic process - informal process with minimal documentation or optimization
  - (5) No clear process - sales happens ad hoc without systematic approach

**3.3 Customer Acquisition Cost (CAC) Management**
- How effectively do you manage and optimize customer acquisition costs across channels?
  - (1) Expert level - sophisticated CAC optimization with channel attribution and LTV modeling
  - (2) Advanced level - strong CAC tracking with regular optimization across channels
  - (3) Good level - basic CAC tracking for main channels with some optimization
  - (4) Limited level - high-level CAC tracking without detailed channel analysis
  - (5) Poor level - little to no systematic CAC tracking or optimization

**3.4 Revenue Diversification Strategy**
- How well diversified is your revenue across customers, products, and channels?
  - (1) Excellent diversification - no single point of failure, resilient revenue base
  - (2) Good diversification - reasonable spread with acceptable concentration risk
  - (3) Moderate diversification - some concentration but manageable risk levels
  - (4) Poor diversification - significant concentration creating business risk
  - (5) High concentration - dangerous dependence on single customer/product/channel

**3.5 Lead Generation Effectiveness**
- How effective and scalable are your lead generation systems?
  - (1) Highly effective - consistent, scalable lead generation across multiple channels
  - (2) Very effective - reliable lead flow with occasional optimization needed
  - (3) Moderately effective - decent lead generation but not consistently scalable
  - (4) Somewhat effective - inconsistent lead generation requiring constant attention
  - (5) Ineffective - poor lead generation creating sales pipeline problems

**3.6 Sales Team Performance Management**
- How effectively do you manage and develop sales team performance?
  - (1) Expert management - data-driven performance management with continuous coaching
  - (2) Strong management - clear metrics and regular performance development
  - (3) Adequate management - basic performance tracking with some development efforts
  - (4) Weak management - limited performance management and development
  - (5) Poor management - minimal performance oversight or team development

**3.7 Revenue Operations Sophistication**
- How sophisticated are your revenue operations (sales/marketing alignment, data analysis)?
  - (1) Advanced RevOps - seamless sales/marketing integration with sophisticated analytics
  - (2) Good RevOps - solid integration with regular data-driven optimization
  - (3) Basic RevOps - some integration efforts but limited analytical sophistication
  - (4) Minimal RevOps - poor sales/marketing alignment with limited data analysis
  - (5) No RevOps - sales and marketing operate independently without integration

### Customer Success & Expansion Branching

**IF B2B Business Model:**

**3.8 Customer Expansion Revenue**
- How effectively do you grow revenue from existing customers?
  - (1) Expert expansion - systematic expansion programs driving 30%+ revenue growth from existing customers
  - (2) Strong expansion - consistent expansion efforts contributing 20-30% revenue growth
  - (3) Moderate expansion - some expansion success contributing 10-20% revenue growth
  - (4) Limited expansion - minimal expansion success contributing <10% revenue growth
  - (5) No expansion - purely acquisition-focused with minimal existing customer growth

**3.9 Customer Success Operations**
- How proactive and systematic is your customer success function?
  - (1) Proactive excellence - predictive customer success with health scoring and automated interventions
  - (2) Strong proactive approach - systematic customer success with regular health monitoring
  - (3) Moderately proactive - some proactive efforts but mostly reactive customer management
  - (4) Mostly reactive - customer success responds to issues but limited proactive efforts
  - (5) Purely reactive - customer success only engages when customers escalate problems

### Follow-Up Question Logic

**IF Score 4+ on Revenue Growth Predictability (3.1):**
- **Follow-up:** What are the main sources of revenue unpredictability?
- **Follow-up:** How does revenue volatility affect your operational planning?

**IF Score 4+ on Customer Acquisition Cost (3.3):**
- **Follow-up:** Which channels have the highest/most unpredictable CAC?
- **Follow-up:** How does poor CAC tracking affect your growth strategy?

## Domain 4: Operational Excellence & Process Management

### Core Questions

**4.1 Process Documentation & Standardization**
- How well documented and standardized are your core business processes?
  - (1) Comprehensive - all critical processes documented with regular updates and training
  - (2) Well documented - most processes documented with good standardization
  - (3) Partially documented - key processes documented but gaps exist
  - (4) Minimally documented - few processes documented, mostly tribal knowledge
  - (5) Undocumented - processes exist in people's heads, no standardization

**4.2 Process Efficiency & Optimization**
- How systematically do you identify and eliminate operational inefficiencies?
  - (1) Continuous optimization - systematic process improvement with data-driven optimization
  - (2) Regular optimization - scheduled process reviews with improvement implementation
  - (3) Periodic optimization - occasional process improvement efforts
  - (4) Minimal optimization - process improvement happens reactively when problems arise
  - (5) No optimization - processes remain static without systematic improvement efforts

**4.3 Quality Control Systems**
- How effective are your quality control and error prevention systems?
  - (1) Proactive quality systems - predictive quality control with automated monitoring
  - (2) Strong quality control - systematic quality processes with regular monitoring
  - (3) Basic quality control - standard quality processes meeting minimum requirements
  - (4) Reactive quality control - quality issues addressed after they occur
  - (5) Poor quality control - frequent quality issues affecting customer satisfaction

**4.4 Operational Scalability**
- How well can your current operational processes handle 2-3x growth?
  - (1) Highly scalable - processes designed for growth with automation and flexibility
  - (2) Mostly scalable - processes can handle growth with minor adjustments
  - (3) Moderately scalable - some processes will need updates for significant growth
  - (4) Limited scalability - many processes will break or become inefficient with growth
  - (5) Not scalable - current processes cannot handle significant growth without complete redesign

**4.5 Cross-Department Coordination**
- How effectively do different departments coordinate on shared processes?
  - (1) Seamless coordination - excellent cross-department integration with clear handoffs
  - (2) Good coordination - solid cross-department processes with minor friction
  - (3) Adequate coordination - coordination works but requires active management
  - (4) Poor coordination - significant friction and inefficiencies between departments
  - (5) Broken coordination - departments operate in silos causing operational problems

**4.6 Performance Measurement & KPIs**
- How comprehensive and actionable are your operational performance metrics?
  - (1) Advanced metrics - comprehensive KPI dashboard with predictive analytics
  - (2) Good metrics - solid KPI tracking with regular performance reviews
  - (3) Basic metrics - standard metrics tracked but limited analytical insights
  - (4) Minimal metrics - few metrics tracked, limited performance visibility
  - (5) No systematic metrics - operational performance not systematically measured

**4.7 Automation & Tool Integration**
- How well integrated and automated are your operational tools and systems?
  - (1) Highly automated - sophisticated automation with seamless tool integration
  - (2) Well automated - good automation with most tools integrated effectively
  - (3) Partially automated - some automation but many manual processes remain
  - (4) Minimally automated - limited automation, mostly manual operations
  - (5) Manual operations - little to no automation, heavy reliance on manual processes

### Industry-Specific Branching

**IF Manufacturing/Physical Products:**

**4.8 Supply Chain Integration**
- How well integrated and optimized is your supply chain management?
  - (1) Fully integrated - end-to-end supply chain visibility with automated optimization
  - (2) Well integrated - good supply chain coordination with regular optimization
  - (3) Partially integrated - basic supply chain management with some coordination
  - (4) Limited integration - poor supply chain coordination creating inefficiencies
  - (5) Fragmented - supply chain operates with minimal integration or optimization

**IF Services Business:**

**4.8 Service Delivery Standardization**
- How standardized and efficient is your service delivery process?
  - (1) Highly standardized - consistent, efficient service delivery with quality guarantees
  - (2) Well standardized - good service consistency with regular quality monitoring
  - (3) Partially standardized - basic standards but some variation in delivery
  - (4) Minimally standardized - service delivery varies significantly by team/individual
  - (5) Unstandardized - service delivery completely dependent on individual approaches

### Follow-Up Question Logic

**IF Score 4+ on Process Documentation (4.1):**
- **Follow-up:** What happens when key team members are unavailable?
- **Follow-up:** How does lack of documentation affect new employee onboarding?

**IF Score 4+ on Operational Scalability (4.4):**
- **Follow-up:** Which processes are most likely to break first during growth?
- **Follow-up:** What operational bottlenecks have you already encountered?

## Domain 5: People & Organizational Development

### Core Questions

**5.1 Talent Acquisition & Retention**
- How effective is your ability to attract and retain top talent?
  - (1) Excellent - consistent ability to attract top talent with low voluntary turnover
  - (2) Very good - strong employer brand with good retention rates
  - (3) Adequate - can fill positions but faces some retention challenges
  - (4) Struggling - difficulty attracting quality talent or high turnover rates
  - (5) Poor - significant talent challenges affecting business operations

**5.2 Organizational Culture & Engagement**
- How strong and aligned is your organizational culture?
  - (1) Exceptional culture - high engagement with strong cultural alignment driving performance
  - (2) Strong culture - good cultural foundation with high employee satisfaction
  - (3) Developing culture - positive culture but inconsistent across the organization
  - (4) Weak culture - cultural issues affecting morale and performance
  - (5) Toxic culture - negative cultural elements creating significant business problems

**5.3 Leadership Development Pipeline**
- How effectively do you develop future leaders within the organization?
  - (1) Sophisticated program - systematic leadership development with clear succession planning
  - (2) Good development - regular leadership training with some succession planning
  - (3) Basic development - occasional leadership training without systematic succession planning
  - (4) Limited development - minimal leadership development efforts
  - (5) No development - no systematic leadership development or succession planning

**5.4 Performance Management System**
- How effective is your performance management and feedback system?
  - (1) Advanced system - continuous performance management with data-driven insights
  - (2) Good system - regular performance reviews with clear improvement planning
  - (3) Standard system - annual/semi-annual reviews with basic feedback
  - (4) Weak system - infrequent or ineffective performance management
  - (5) No system - minimal performance feedback or management

**5.5 Skills Development & Training**
- How systematically do you develop employee skills and capabilities?
  - (1) Strategic development - comprehensive training programs aligned with business strategy
  - (2) Good development - regular training with individual development plans
  - (3) Basic development - some training opportunities but not systematic
  - (4) Minimal development - limited training mainly for compliance or basic skills
  - (5) No development - minimal investment in employee skill development

**5.6 Communication & Information Flow**
- How effectively does information flow throughout the organization?
  - (1) Excellent communication - transparent, timely information sharing at all levels
  - (2) Good communication - regular communication with minor information gaps
  - (3) Adequate communication - communication works but could be more effective
  - (4) Poor communication - significant information silos and communication gaps
  - (5) Broken communication - information doesn't flow effectively, creating operational problems

**5.7 Organizational Agility & Change Management**
- How effectively does your organization adapt to change?
  - (1) Highly agile - organization embraces change with systematic change management
  - (2) Quite agile - good change adaptation with effective change management processes
  - (3) Moderately agile - can adapt to change but requires significant management effort
  - (4) Low agility - organization struggles with change, requiring extensive change management
  - (5) Change resistant - organization resists change, making adaptation very difficult

### Scale-Based Branching

**IF Team Size > 50:**

**5.8 Middle Management Effectiveness**
- How effective is your middle management layer at executing strategy and developing teams?
  - (1) Highly effective - middle managers are strong strategic executors and team developers
  - (2) Very effective - good middle management with occasional development needs
  - (3) Moderately effective - middle management adequate but inconsistent
  - (4) Somewhat effective - middle management struggles with strategy execution or team development
  - (5) Ineffective - middle management layer creates bottlenecks and execution problems

**IF Rapid Growth (>50% headcount growth in past year):**

**5.9 Scaling Culture & Integration**
- How effectively have you maintained culture and integrated new hires during rapid growth?
  - (1) Excellent integration - culture remains strong with seamless new hire integration
  - (2) Good integration - culture mostly maintained with effective onboarding
  - (3) Adequate integration - some cultural dilution but manageable integration
  - (4) Poor integration - significant cultural challenges and integration problems
  - (5) Failed integration - rapid growth has damaged culture and created integration crisis

### Follow-Up Question Logic

**IF Score 4+ on Talent Acquisition & Retention (5.1):**
- **Follow-up:** What are your biggest talent challenges (attraction vs retention)?
- **Follow-up:** How do talent issues affect your ability to execute strategy?

**IF Score 4+ on Organizational Culture (5.2):**
- **Follow-up:** What specific cultural issues are affecting business performance?
- **Follow-up:** How do cultural problems manifest in day-to-day operations?

## Domain 6: Technology & Data Infrastructure

### Core Questions

**6.1 Technology Stack Scalability**
- How well can your current technology infrastructure support 3x business growth?
  - (1) Highly scalable - technology designed for growth with auto-scaling and redundancy
  - (2) Mostly scalable - technology can handle growth with minor upgrades
  - (3) Moderately scalable - some technology updates needed for significant growth
  - (4) Limited scalability - major technology investments required for growth
  - (5) Not scalable - current technology cannot support significant growth

**6.2 Data Quality & Accessibility**
- How reliable and accessible is business-critical data across your organization?
  - (1) Excellent data - high-quality, real-time data accessible to all decision-makers
  - (2) Good data - reliable data with good accessibility and minor quality issues
  - (3) Adequate data - reasonable data quality with some accessibility challenges
  - (4) Poor data - significant data quality or accessibility problems
  - (5) Terrible data - unreliable data hampering decision-making across the organization

**6.3 System Integration & Workflow Automation**
- How well integrated are your business systems and workflows?
  - (1) Fully integrated - seamless system integration with comprehensive workflow automation
  - (2) Well integrated - good system integration with substantial automation
  - (3) Partially integrated - some integration but significant manual processes remain
  - (4) Poorly integrated - systems operate independently with minimal automation
  - (5) Fragmented - systems don't integrate, requiring extensive manual data transfer

**6.4 Technology Security & Compliance**
- How robust is your technology security and compliance posture?
  - (1) Enterprise-grade - comprehensive security with automated compliance monitoring
  - (2) Strong security - solid security practices with good compliance management
  - (3) Adequate security - basic security meeting minimum requirements
  - (4) Weak security - security gaps creating risk exposure
  - (5) Poor security - significant security vulnerabilities affecting business operations

**6.5 Business Intelligence & Analytics**
- How sophisticated are your business intelligence and analytics capabilities?
  - (1) Advanced analytics - predictive analytics with real-time business intelligence
  - (2) Good analytics - solid BI tools with regular analytical insights
  - (3) Basic analytics - standard reporting with limited analytical capabilities
  - (4) Minimal analytics - basic reporting without significant analytical insights
  - (5) No analytics - minimal business intelligence or analytical capabilities

**6.6 Technology Team Capability**
- How capable is your internal technology team at supporting business needs?
  - (1) Highly capable - strong internal team with expertise across all business technology needs
  - (2) Very capable - good internal team with occasional external expertise needed
  - (3) Adequately capable - competent team but limited in some areas
  - (4) Limited capability - team struggles to support all business technology needs
  - (5) Insufficient capability - technology team cannot adequately support business operations

**6.7 Digital Transformation & Innovation**
- How effectively does your organization leverage technology for competitive advantage?
  - (1) Innovation leader - technology creates significant competitive advantages
  - (2) Strong innovation - technology provides clear business benefits and differentiation
  - (3) Moderate innovation - technology supports business but doesn't create competitive advantage
  - (4) Limited innovation - technology mainly supports existing processes without innovation
  - (5) Technology laggard - technology holds back business innovation and competitiveness

### Industry-Specific Branching

**IF B2B SaaS/Technology Company:**

**6.8 Product Technology Architecture**
- How scalable and maintainable is your core product technology architecture?
  - (1) Excellent architecture - highly scalable, maintainable architecture supporting rapid feature development
  - (2) Good architecture - solid architecture with good scalability and maintainability
  - (3) Adequate architecture - architecture works but has some scalability or maintainability limitations
  - (4) Poor architecture - significant architectural debt affecting development speed and scalability
  - (5) Legacy architecture - architectural problems significantly limiting business growth

**IF Regulated Industry:**

**6.8 Regulatory Technology Compliance**
- How well does your technology infrastructure support regulatory compliance requirements?
  - (1) Compliance-optimized - technology infrastructure designed for regulatory efficiency
  - (2) Strong compliance - technology well-suited for regulatory requirements
  - (3) Adequate compliance - technology meets regulatory requirements but not optimized
  - (4) Compliance struggles - technology makes regulatory compliance difficult or expensive
  - (5) Compliance risk - technology infrastructure creates regulatory compliance risks

### Follow-Up Question Logic

**IF Score 4+ on Technology Stack Scalability (6.1):**
- **Follow-up:** What specific technology constraints are limiting growth?
- **Follow-up:** What's your technology investment timeline for supporting growth?

**IF Score 4+ on Data Quality & Accessibility (6.2):**
- **Follow-up:** How do data problems affect decision-making speed and quality?
- **Follow-up:** Which business functions are most affected by data issues?

## Domain 7: Customer Experience & Product Development

### Core Questions

**7.1 Customer Satisfaction & Loyalty**
- How satisfied and loyal are your customers compared to industry standards?
  - (1) Exceptional satisfaction - industry-leading satisfaction with high loyalty and advocacy
  - (2) High satisfaction - strong customer satisfaction with good retention rates
  - (3) Adequate satisfaction - reasonable satisfaction meeting industry averages
  - (4) Below average satisfaction - customer satisfaction below industry standards
  - (5) Poor satisfaction - significant customer satisfaction problems affecting retention

**7.2 Product-Market Fit Strength**
- How strong is your product-market fit across your customer segments?
  - (1) Exceptional fit - strong product-market fit with high customer demand and low churn
  - (2) Strong fit - good product-market fit with satisfied customers and reasonable retention
  - (3) Moderate fit - decent product-market fit but opportunities for improvement
  - (4) Weak fit - product-market fit challenges affecting growth and retention
  - (5) Poor fit - significant product-market fit problems requiring major changes

**7.3 Customer Feedback Integration**
- How effectively do you collect and act on customer feedback?
  - (1) Systematic integration - comprehensive feedback collection with rapid product/service integration
  - (2) Good integration - regular feedback collection with consistent improvement implementation
  - (3) Basic integration - some feedback collection with occasional improvements
  - (4) Limited integration - minimal feedback collection or slow improvement implementation
  - (5) No integration - customer feedback not systematically collected or acted upon

**7.4 Product Development Speed & Quality**
- How quickly and effectively do you develop and launch new products/features?
  - (1) Rapid, high-quality development - fast development cycles with excellent quality and market fit
  - (2) Good development pace - reasonable development speed with good quality
  - (3) Moderate development - acceptable development speed and quality
  - (4) Slow development - development cycles too slow for market needs
  - (5) Poor development - slow development with quality problems affecting customer satisfaction

**7.5 Customer Journey Optimization**
- How well optimized is the customer journey from awareness to advocacy?
  - (1) Highly optimized - seamless, delightful customer journey driving high conversion and advocacy
  - (2) Well optimized - smooth customer journey with good conversion rates
  - (3) Moderately optimized - decent customer journey with room for improvement
  - (4) Poorly optimized - customer journey has friction points affecting conversion
  - (5) Not optimized - customer journey creates barriers to conversion and satisfaction

**7.6 Customer Support Excellence**
- How effective and efficient is your customer support function?
  - (1) World-class support - proactive, efficient support creating competitive advantage
  - (2) Excellent support - responsive, helpful support with high customer satisfaction
  - (3) Good support - adequate support meeting customer expectations
  - (4) Poor support - support issues affecting customer satisfaction and retention
  - (5) Terrible support - support problems significantly damaging customer relationships

**7.7 Innovation & Differentiation**
- How effectively do you innovate to maintain competitive differentiation?
  - (1) Innovation leader - consistent innovation creating strong competitive moats
  - (2) Strong innovator - regular innovation maintaining competitive advantages
  - (3) Moderate innovation - some innovation but not consistently differentiating
  - (4) Slow innovation - innovation pace falling behind competitive needs
  - (5) Innovation laggard - insufficient innovation allowing competitors to gain advantages

### Business Model Branching

**IF B2B Business:**

**7.8 Customer Success & Account Growth**
- How effectively do you drive success and growth within existing accounts?
  - (1) Exceptional account growth - systematic customer success driving significant expansion revenue
  - (2) Strong account growth - good customer success with consistent expansion opportunities
  - (3) Moderate account growth - some customer success efforts with occasional expansion
  - (4) Limited account growth - minimal focus on customer success and account expansion
  - (5) Poor account management - customer success problems affecting retention and growth

**IF B2C Business:**

**7.8 Brand & Customer Experience**
- How strong is your brand and overall customer experience compared to competitors?
  - (1) Premium brand - industry-leading brand with exceptional customer experience
  - (2) Strong brand - well-regarded brand with consistently good customer experience
  - (3) Decent brand - adequate brand recognition with reasonable customer experience
  - (4) Weak brand - limited brand recognition with customer experience issues
  - (5) Poor brand - negative brand perception with poor customer experience

### Follow-Up Question Logic

**IF Score 4+ on Customer Satisfaction (7.1):**
- **Follow-up:** What are the primary drivers of customer dissatisfaction?
- **Follow-up:** How do satisfaction problems affect customer lifetime value?

**IF Score 4+ on Product-Market Fit (7.2):**
- **Follow-up:** Which customer segments have the weakest product-market fit?
- **Follow-up:** What product/service changes are needed to improve market fit?

## Domain 8: Supply Chain & Operations (Manufacturing/Physical Products)

### Core Questions

**8.1 Supply Chain Reliability & Resilience**
- How reliable and resilient is your supply chain to disruptions?
  - (1) Highly resilient - diversified supply chain with excellent risk management
  - (2) Very resilient - strong supply chain with good contingency planning
  - (3) Moderately resilient - adequate supply chain with some risk management
  - (4) Somewhat vulnerable - supply chain has significant risk exposure
  - (5) Highly vulnerable - supply chain disruptions regularly affect business operations

**8.2 Inventory Management Optimization**
- How well optimized is your inventory management across the supply chain?
  - (1) Highly optimized - sophisticated inventory management minimizing costs while ensuring availability
  - (2) Well optimized - good inventory management with occasional optimization opportunities
  - (3) Adequately managed - reasonable inventory management meeting basic needs
  - (4) Poorly managed - inventory management creates cost or availability problems
  - (5) Unmanaged - inventory problems significantly affecting operations and customer satisfaction

**8.3 Supplier Relationship Management**
- How effectively do you manage and develop supplier relationships?
  - (1) Strategic partnerships - suppliers are true partners contributing to competitive advantage
  - (2) Strong relationships - good supplier management with collaborative relationships
  - (3) Adequate relationships - basic supplier management meeting operational needs
  - (4) Poor relationships - supplier management creates operational inefficiencies
  - (5) Problematic relationships - supplier issues regularly disrupt business operations

**8.4 Manufacturing/Operations Efficiency**
- How efficient are your manufacturing or operational processes?
  - (1) World-class efficiency - industry-leading operational efficiency creating competitive advantage
  - (2) High efficiency - strong operational efficiency with regular improvement efforts
  - (3) Good efficiency - adequate operational efficiency meeting industry standards
  - (4) Poor efficiency - operational inefficiencies affecting costs and competitiveness
  - (5) Very poor efficiency - significant operational problems affecting business viability

**8.5 Quality Control & Assurance**
- How robust are your quality control systems throughout operations?
  - (1) Exceptional quality - comprehensive quality systems creating competitive differentiation
  - (2) Strong quality - robust quality control with consistent high-quality outputs
  - (3) Adequate quality - basic quality control meeting customer expectations
  - (4) Poor quality - quality issues affecting customer satisfaction and costs
  - (5) Quality problems - significant quality issues damaging customer relationships and profitability

### Industry-Specific Branching

**IF International Supply Chain:**

**8.6 Global Supply Chain Management**
- How effectively do you manage the complexities of international supply chains?
  - (1) Expert management - sophisticated global supply chain providing competitive advantages
  - (2) Strong management - effective international supply chain management
  - (3) Adequate management - international supply chain works but not optimized
  - (4) Poor management - international complexity creates operational challenges
  - (5) Struggling - international supply chain problems affecting business operations

**IF Just-in-Time or Complex Assembly:**

**8.6 Production Planning & Scheduling**
- How sophisticated and effective is your production planning and scheduling?
  - (1) Advanced planning - sophisticated planning systems optimizing efficiency and customer service
  - (2) Good planning - effective planning systems with good execution
  - (3) Basic planning - adequate planning meeting operational needs
  - (4) Poor planning - planning inefficiencies affecting costs and customer service
  - (5) Chaotic planning - planning problems creating significant operational disruption

## Domain 9: Risk Management & Compliance

### Core Questions

**9.1 Risk Identification & Assessment**
- How comprehensively do you identify and assess business risks?
  - (1) Sophisticated risk management - comprehensive risk identification with quantitative assessment
  - (2) Good risk management - systematic risk identification with regular assessment
  - (3) Basic risk management - key risks identified with periodic assessment
  - (4) Limited risk management - minimal risk identification or assessment
  - (5) No systematic risk management - risks not systematically identified or managed

**9.2 Compliance Management System**
- How effective is your system for managing regulatory and legal compliance?
  - (1) Proactive compliance - comprehensive compliance management creating competitive advantages
  - (2) Strong compliance - systematic compliance with good monitoring and updating
  - (3) Adequate compliance - basic compliance meeting legal requirements
  - (4) Reactive compliance - compliance managed reactively with occasional gaps
  - (5) Poor compliance - compliance gaps creating legal or regulatory risks

**9.3 Business Continuity Planning**
- How prepared is your organization for business continuity during disruptions?
  - (1) Excellent preparedness - comprehensive business continuity plans with regular testing
  - (2) Good preparedness - solid business continuity planning with periodic testing
  - (3) Basic preparedness - basic business continuity plans in place
  - (4) Limited preparedness - minimal business continuity planning
  - (5) No preparedness - no systematic business continuity planning

**9.4 Financial Risk Management**
- How effectively do you identify and manage financial risks?
  - (1) Sophisticated financial risk management - comprehensive identification and mitigation
  - (2) Good financial risk management - systematic approach with regular monitoring
  - (3) Basic financial risk management - key financial risks managed
  - (4) Limited financial risk management - minimal financial risk oversight
  - (5) Poor financial risk management - financial risks not systematically managed

**9.5 Cybersecurity & Data Protection**
- How robust is your cybersecurity and data protection program?
  - (1) Enterprise-grade cybersecurity - comprehensive security with proactive threat management
  - (2) Strong cybersecurity - solid security practices with regular updates and monitoring
  - (3) Adequate cybersecurity - basic security meeting minimum requirements
  - (4) Weak cybersecurity - security gaps creating risk exposure
  - (5) Poor cybersecurity - significant security vulnerabilities threatening business operations

**9.6 Insurance & Risk Transfer**
- How appropriately do you use insurance and other risk transfer mechanisms?
  - (1) Optimized risk transfer - sophisticated insurance strategy balancing cost and coverage
  - (2) Good risk transfer - appropriate insurance coverage with regular reviews
  - (3) Adequate risk transfer - basic insurance meeting key risk coverage needs
  - (4) Limited risk transfer - insufficient insurance or risk transfer mechanisms
  - (5) Poor risk transfer - inadequate insurance creating significant risk exposure

### Industry-Specific Branching

**IF Regulated Industry (Financial Services, Healthcare, Energy):**

**9.7 Regulatory Compliance Excellence**
- How sophisticated is your regulatory compliance management?
  - (1) Compliance excellence - regulatory compliance creates competitive advantages
  - (2) Strong compliance - sophisticated compliance management with proactive monitoring
  - (3) Adequate compliance - meets regulatory requirements with standard processes
  - (4) Compliance struggles - difficulty maintaining compliance requirements
  - (5) Compliance failures - regulatory compliance issues affecting business operations

**9.8 Regulatory Risk Assessment**
- How effectively do you assess and manage regulatory risks?
  - (1) Advanced regulatory risk management - sophisticated assessment and mitigation strategies
  - (2) Good regulatory risk management - systematic approach with regular updates
  - (3) Basic regulatory risk management - key regulatory risks identified and managed
  - (4) Limited regulatory risk management - minimal regulatory risk oversight
  - (5) Poor regulatory risk management - regulatory risks not systematically managed

**IF High-Risk Industry (Finance, Healthcare, Chemicals):**

**9.7 Operational Risk Management**
- How comprehensively do you manage operational risks specific to your industry?
  - (1) Industry-leading risk management - operational risk management creates competitive advantages
  - (2) Strong operational risk management - comprehensive approach with regular monitoring
  - (3) Adequate operational risk management - key operational risks managed effectively
  - (4) Limited operational risk management - operational risks not comprehensively managed
  - (5) Poor operational risk management - operational risk exposures threatening business

### Follow-Up Question Logic

**IF Score 4+ on Risk Identification (9.1):**
- **Follow-up:** What types of risks have surprised your organization in the past?
- **Follow-up:** How do unidentified risks typically impact business operations?

**IF Score 4+ on Compliance Management (9.2):**
- **Follow-up:** Which compliance areas are most challenging to manage?
- **Follow-up:** Have compliance gaps created business problems or penalties?

## Domain 10: External Partnerships & Ecosystem

### Core Questions

**10.1 Strategic Partnership Portfolio**
- How effective is your portfolio of strategic partnerships in driving business value?
  - (1) Exceptional partnerships - strategic partnerships create significant competitive advantages
  - (2) Strong partnerships - effective partnerships contributing meaningfully to business success
  - (3) Moderate partnerships - partnerships provide some value but not optimized
  - (4) Weak partnerships - partnerships exist but contribute minimal business value
  - (5) Poor partnerships - partnerships drain resources or create problems

**10.2 Partner Relationship Management**
- How effectively do you manage and develop partner relationships?
  - (1) Advanced partner management - systematic partner development with mutual value creation
  - (2) Good partner management - solid partner relationships with regular communication
  - (3) Basic partner management - adequate partner management meeting minimum needs
  - (4) Poor partner management - partner relationships not effectively managed
  - (5) Neglected partnerships - partnerships exist but receive minimal management attention

**10.3 Ecosystem Integration & Collaboration**
- How well integrated are you within your industry ecosystem?
  - (1) Ecosystem leader - central position in industry ecosystem influencing standards and direction
  - (2) Well integrated - strong ecosystem participation with influential relationships
  - (3) Moderately integrated - decent ecosystem participation but not influential
  - (4) Poorly integrated - limited ecosystem participation missing opportunities
  - (5) Isolated - minimal ecosystem integration limiting business opportunities

**10.4 Channel Partner Effectiveness**
- How effective are your channel partners in driving sales and customer success?
  - (1) Exceptional channels - channel partners drive significant revenue with high satisfaction
  - (2) Strong channels - effective channel partners contributing meaningfully to growth
  - (3) Adequate channels - channel partners provide reasonable value
  - (4) Weak channels - channel partners contribute limited value or create problems
  - (5) Poor channels - channel relationships drain resources or damage brand

**10.5 Vendor & Supplier Management**
- How strategically do you manage relationships with key vendors and suppliers?
  - (1) Strategic vendor management - vendors are true partners contributing to competitive advantage
  - (2) Good vendor management - effective vendor relationships with mutual value creation
  - (3) Adequate vendor management - vendor relationships meet operational needs
  - (4) Poor vendor management - vendor relationships create operational inefficiencies
  - (5) Problematic vendors - vendor issues regularly disrupt business operations

**10.6 Innovation & Technology Partnerships**
- How effectively do you leverage partnerships for innovation and technology advancement?
  - (1) Innovation catalyst - partnerships accelerate innovation and provide technology advantages
  - (2) Good innovation partnerships - partnerships contribute meaningfully to innovation efforts
  - (3) Some innovation partnerships - partnerships provide occasional innovation value
  - (4) Limited innovation partnerships - partnerships don't significantly contribute to innovation
  - (5) No innovation partnerships - missing partnership opportunities for innovation and technology

### Business Model Branching

**IF B2B Business with Channel Sales:**

**10.7 Channel Partner Enablement**
- How effectively do you enable channel partners to sell and support your solutions?
  - (1) Comprehensive enablement - world-class partner training, tools, and support
  - (2) Strong enablement - good partner support with effective training and resources
  - (3) Basic enablement - adequate partner support meeting minimum needs
  - (4) Poor enablement - partner support inadequate affecting their performance
  - (5) No enablement - partners receive minimal support limiting their effectiveness

**IF Technology/Software Company:**

**10.7 Integration Partnership Strategy**
- How strategic and effective are your technology integration partnerships?
  - (1) Strategic integration ecosystem - integration partnerships create significant competitive moats
  - (2) Strong integration partnerships - effective integrations providing customer value
  - (3) Basic integrations - standard integrations meeting customer needs
  - (4) Limited integrations - integration partnerships not effectively leveraged
  - (5) Poor integration strategy - missing integration opportunities or poorly executed partnerships

**IF Platform/Marketplace Business:**

**10.7 Platform Ecosystem Development**
- How effectively do you develop and manage your platform ecosystem?
  - (1) Thriving ecosystem - vibrant platform ecosystem creating network effects
  - (2) Strong ecosystem - healthy platform participation with growing network effects
  - (3) Developing ecosystem - platform ecosystem showing promise but not mature
  - (4) Weak ecosystem - limited platform adoption or engagement
  - (5) Struggling ecosystem - platform ecosystem failing to gain traction

### Follow-Up Question Logic

**IF Score 4+ on Strategic Partnership Portfolio (10.1):**
- **Follow-up:** What prevents partnerships from delivering expected business value?
- **Follow-up:** How do partnership problems affect competitive positioning?

**IF Score 4+ on Ecosystem Integration (10.3):**
- **Follow-up:** What ecosystem opportunities is the organization missing?
- **Follow-up:** How does limited ecosystem integration affect market position?

## Domain 11: Customer Success & Growth (CSG)

### Core Questions

**11.1 Customer Lifecycle Management**
- How effectively do you manage the complete customer lifecycle from onboarding to renewal?
  - (1) Exceptional lifecycle management - systematic, proactive management driving high satisfaction and growth
  - (2) Strong lifecycle management - good customer journey management with consistent value delivery
  - (3) Adequate lifecycle management - basic lifecycle management meeting customer expectations
  - (4) Poor lifecycle management - lifecycle gaps affecting customer satisfaction and retention
  - (5) No systematic lifecycle management - customers managed reactively without systematic approach

**11.2 Customer Health & Risk Management**
- How proactively do you identify and address customer health and churn risks?
  - (1) Predictive health management - sophisticated health scoring with proactive intervention
  - (2) Good health monitoring - systematic health tracking with regular intervention
  - (3) Basic health monitoring - some health indicators tracked with reactive intervention
  - (4) Limited health monitoring - minimal customer health visibility
  - (5) No health monitoring - customer health and risks not systematically tracked

**11.3 Customer Expansion & Upselling**
- How effectively do you drive expansion revenue from existing customers?
  - (1) Systematic expansion engine - sophisticated expansion programs driving significant growth
  - (2) Strong expansion efforts - consistent expansion success with good processes
  - (3) Moderate expansion - some expansion success but not systematic
  - (4) Limited expansion - minimal focus on customer expansion opportunities
  - (5) No expansion strategy - purely focused on retention without growth initiatives

**11.4 Customer Advocacy & References**
- How effectively do you develop customer advocates and generate references?
  - (1) Advocate engine - systematic advocate development driving significant business value
  - (2) Strong advocacy program - good advocate relationships providing regular business value
  - (3) Some advocacy efforts - occasional advocate development with limited systematic approach
  - (4) Limited advocacy - minimal focus on developing customer advocates
  - (5) No advocacy strategy - missing opportunities to leverage satisfied customers

**11.5 Customer Success Team Performance**
- How effective is your customer success team at driving customer outcomes?
  - (1) World-class customer success - industry-leading customer success driving exceptional outcomes
  - (2) Strong customer success - effective team with good customer outcome achievement
  - (3) Adequate customer success - team meets basic customer success needs
  - (4) Weak customer success - team struggles to drive consistent customer outcomes
  - (5) Poor customer success - team performance problems affecting customer relationships

**11.6 Customer Feedback & Product Integration**
- How effectively do you integrate customer feedback into product and service improvements?
  - (1) Seamless integration - sophisticated feedback integration driving continuous improvement
  - (2) Good integration - regular feedback integration with product/service improvements
  - (3) Basic integration - some feedback integration but not systematic
  - (4) Limited integration - minimal feedback integration into improvements
  - (5) No integration - customer feedback not systematically integrated into business improvements

### Business Model Branching

**IF Subscription/SaaS Business:**

**11.7 Churn Prediction & Prevention**
- How sophisticated are your churn prediction and prevention capabilities?
  - (1) Advanced churn prevention - predictive analytics with proactive intervention reducing churn significantly
  - (2) Good churn prevention - solid churn prediction with effective intervention programs
  - (3) Basic churn prevention - some churn indicators tracked with reactive intervention
  - (4) Limited churn prevention - minimal churn prediction or prevention efforts
  - (5) No churn prevention - churn managed reactively without prediction or systematic prevention

**11.8 Customer Onboarding Excellence**
- How effective is your customer onboarding in driving time-to-value and long-term success?
  - (1) Exceptional onboarding - systematic onboarding driving rapid value realization and high satisfaction
  - (2) Strong onboarding - effective onboarding with good customer success outcomes
  - (3) Adequate onboarding - basic onboarding meeting customer expectations
  - (4) Poor onboarding - onboarding gaps affecting customer satisfaction and success
  - (5) Broken onboarding - onboarding problems creating customer satisfaction and retention issues

**IF High-Touch B2B Business:**

**11.7 Account Management Excellence**
- How strategic and effective is your account management for key customers?
  - (1) Strategic account management - account managers drive significant customer success and expansion
  - (2) Strong account management - effective account management with good customer outcomes
  - (3) Adequate account management - account management meets basic customer needs
  - (4) Weak account management - account management struggles to drive customer success
  - (5) Poor account management - account management problems affecting customer relationships

### Follow-Up Question Logic

**IF Score 4+ on Customer Lifecycle Management (11.1):**
- **Follow-up:** Which stages of the customer lifecycle have the biggest gaps?
- **Follow-up:** How do lifecycle management gaps affect customer lifetime value?

**IF Score 4+ on Customer Health & Risk Management (11.2):**
- **Follow-up:** What typically causes customer health issues or churn?
- **Follow-up:** How much advance warning do you typically have before customer churn?

## Domain 12: Change Management & Implementation

### Core Questions

**12.1 Change Management Capability**
- How effectively does your organization plan and execute organizational changes?
  - (1) Change management excellence - systematic change management with high success rates
  - (2) Strong change management - good change planning and execution with occasional challenges
  - (3) Adequate change management - basic change management meeting organizational needs
  - (4) Weak change management - change initiatives often struggle or fail
  - (5) Poor change management - organization cannot effectively execute significant changes

**12.2 Implementation Excellence**
- How effectively does your organization turn plans and strategies into executed results?
  - (1) Implementation excellence - consistent translation of strategy into results with high success rates
  - (2) Strong implementation - good execution with most initiatives achieving intended results
  - (3) Adequate implementation - reasonable execution with mixed success rates
  - (4) Weak implementation - implementation struggles with many initiatives failing to achieve goals
  - (5) Poor implementation - significant gap between planning and execution

**12.3 Communication During Change**
- How effectively do you communicate during periods of organizational change?
  - (1) Exceptional change communication - transparent, timely communication creating buy-in and understanding
  - (2) Strong change communication - effective communication with good stakeholder engagement
  - (3) Adequate change communication - basic communication meeting minimum change management needs
  - (4) Poor change communication - communication gaps creating resistance and confusion
  - (5) Terrible change communication - communication problems significantly hampering change efforts

**12.4 Stakeholder Buy-in & Engagement**
- How effectively do you secure stakeholder buy-in for organizational changes?
  - (1) Expert stakeholder engagement - systematic stakeholder management creating strong change coalition
  - (2) Good stakeholder engagement - effective stakeholder management with strong buy-in
  - (3) Adequate stakeholder engagement - reasonable stakeholder management with some resistance
  - (4) Poor stakeholder engagement - stakeholder resistance creating change implementation problems
  - (5) Failed stakeholder engagement - stakeholder opposition preventing successful change implementation

**12.5 Training & Capability Development**
- How effectively do you build organizational capabilities to support changes?
  - (1) Comprehensive capability building - systematic training and development supporting all change initiatives
  - (2) Good capability building - effective training with good skill development supporting changes
  - (3) Basic capability building - adequate training meeting minimum change support needs
  - (4) Limited capability building - insufficient training hampering change implementation
  - (5) No capability building - lack of training and development preventing successful change implementation

**12.6 Change Measurement & Course Correction**
- How effectively do you measure change progress and adjust implementation when needed?
  - (1) Sophisticated change measurement - comprehensive metrics with rapid course correction
  - (2) Good change measurement - solid measurement systems with effective adjustments
  - (3) Basic change measurement - some measurement with occasional course corrections
  - (4) Limited change measurement - minimal measurement hampering effective change management
  - (5) No change measurement - changes implemented without systematic measurement or adjustment

**12.7 Organizational Readiness for Change**
- How ready is your organization to embrace and execute the changes needed for growth?
  - (1) Highly change-ready - organization embraces change as competitive advantage
  - (2) Change-ready - organization adapts well to change with good change capacity
  - (3) Moderately change-ready - organization can handle change but requires significant management
  - (4) Change-resistant - organization struggles with change requiring extensive change management
  - (5) Change-adverse - organization actively resists change making growth initiatives very difficult

### Scale-Based Branching

**IF Large Organization (100+ employees):**

**12.8 Multi-Level Change Coordination**
- How effectively do you coordinate change initiatives across multiple organizational levels?
  - (1) Seamless coordination - sophisticated change coordination across all organizational levels
  - (2) Good coordination - effective change coordination with minor gaps
  - (3) Adequate coordination - reasonable coordination but requires significant management attention
  - (4) Poor coordination - coordination gaps creating change implementation problems
  - (5) No coordination - change initiatives conflict or work at cross-purposes

**IF Rapid Growth Company:**

**12.8 Growth-Related Change Management**
- How effectively do you manage the continuous changes required by rapid growth?
  - (1) Growth change excellence - systematic approach to growth-driven change with minimal disruption
  - (2) Good growth change management - effective management of growth-related changes
  - (3) Adequate growth change management - growth changes managed but with significant effort
  - (4) Struggling with growth changes - growth-driven changes create organizational stress and problems
  - (5) Growth change crisis - organization cannot effectively manage the changes required by growth

### Follow-Up Question Logic

**IF Score 4+ on Change Management Capability (12.1):**
- **Follow-up:** What types of changes are most difficult for your organization?
- **Follow-up:** What typically causes change initiatives to fail or struggle?

**IF Score 4+ on Implementation Excellence (12.2):**
- **Follow-up:** What's the biggest gap between planning and execution?
- **Follow-up:** Which types of initiatives have the lowest success rates?

---

## Triage Scoring Algorithm

### Agent Activation Threshold
Domains scoring 4 or 5 (average across all questions in domain) trigger specialist agent activation for deep analysis.

### Critical Issue Identification
- **Score 5 in any domain:** Immediate priority for Perfect Prioritization Algorithm
- **Score 4.5+:** High priority requiring detailed agent analysis
- **Score 4.0-4.4:** Moderate priority for agent review
- **Score 3.5-3.9:** Monitor but may not require specialist agent activation

### Cross-Domain Dependencies
- Strategic Alignment issues affect all other domains
- Financial Management issues limit implementation capacity
- People & Culture issues affect all transformation efforts
- Technology issues can bottleneck operational improvements

### Industry-Specific Weighting
- **Regulated industries:** Higher weighting on Risk Management & Compliance
- **Technology companies:** Higher weighting on Product Development & Technology Infrastructure  
- **Service businesses:** Higher weighting on People & Customer Success
- **Manufacturing:** Higher weighting on Operations & Supply Chain

This comprehensive question database provides the foundation for intelligent triage and agent activation while ensuring comprehensive coverage of all operational areas that could impact growth potential.
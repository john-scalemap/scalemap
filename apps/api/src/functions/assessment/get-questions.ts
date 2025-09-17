import { Question, DomainName } from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET'
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    // Comprehensive question database based on the assessment questions database
    const questionDatabase: Record<DomainName, Question[]> = {
      'strategic-alignment': [
        {
          id: '1.1',
          type: 'multiple-choice',
          question: 'How clearly can your leadership team articulate your company\'s 3-year vision in one sentence?',
          options: [
            'Crystal clear - everyone gives the same answer',
            'Mostly clear - minor variations in wording',
            'Somewhat clear - general alignment but different emphases',
            'Unclear - significant variations in interpretation',
            'No clear vision - leadership gives contradictory answers'
          ],
          required: true
        },
        {
          id: '1.2',
          type: 'multiple-choice',
          question: 'When making resource allocation decisions, how often do teams reference strategic priorities?',
          options: [
            'Always - every major decision includes strategic impact analysis',
            'Usually - strategic considerations are standard part of decisions',
            'Sometimes - strategic alignment happens for bigger decisions',
            'Rarely - decisions made mostly on operational needs',
            'Never - strategic priorities don\'t influence day-to-day resource allocation'
          ],
          required: true
        },
        {
          id: '1.3',
          type: 'multiple-choice',
          question: 'How well do individual team goals connect to company-wide objectives?',
          options: [
            'Perfect alignment - every team goal clearly traces to strategic objectives',
            'Strong alignment - most goals connect with clear reasoning',
            'Moderate alignment - connections exist but aren\'t always clear',
            'Weak alignment - some teams have goals unrelated to strategy',
            'No alignment - team goals set independently of strategic objectives'
          ],
          required: true
        },
        {
          id: '1.4',
          type: 'multiple-choice',
          question: 'How accurately does your leadership team assess your competitive position?',
          options: [
            'Highly accurate - deep market intelligence informs all strategic decisions',
            'Mostly accurate - good understanding with minor blind spots',
            'Reasonably accurate - understanding is correct but not comprehensive',
            'Somewhat inaccurate - significant gaps in competitive intelligence',
            'Highly inaccurate - leadership operates with poor market understanding'
          ],
          required: true
        },
        {
          id: '1.5',
          type: 'multiple-choice',
          question: 'How often does leadership communicate strategic updates to the organization?',
          options: [
            'Weekly - consistent strategic context in regular communications',
            'Monthly - regular strategic updates with clear progress tracking',
            'Quarterly - strategic communication tied to business cycles',
            'Semi-annually - strategic updates happen but infrequently',
            'Annually or less - minimal strategic communication to teams'
          ],
          required: true
        },
        {
          id: '1.6',
          type: 'multiple-choice',
          question: 'When market conditions change, how quickly can your organization adapt strategy?',
          options: [
            'Within weeks - agile strategic planning with rapid execution',
            'Within 1-2 months - efficient strategic adaptation process',
            'Within 3-6 months - standard strategic planning cycles allow adaptation',
            'Within 6-12 months - slow strategic adaptation due to planning constraints',
            'Over 12 months - strategic planning too rigid for market adaptation'
          ],
          required: true
        },
        {
          id: '1.7',
          type: 'multiple-choice',
          question: 'How well does your strategic planning incorporate regulatory compliance requirements?',
          options: [
            'Fully integrated - compliance drives strategic opportunities',
            'Well integrated - compliance considerations built into all strategic decisions',
            'Moderately integrated - compliance considered but not central to strategy',
            'Poorly integrated - compliance seen as separate from strategic planning',
            'Not integrated - regulatory requirements reactive, not strategic'
          ],
          required: false,
          industrySpecific: {
            regulated: true
          }
        }
      ],

      'financial-management': [
        {
          id: '2.1',
          type: 'multiple-choice',
          question: 'How accurately can you predict monthly cash flow 3 months in advance?',
          options: [
            'Within 5% - highly predictable with robust forecasting models',
            'Within 10% - good predictability with minor seasonal variations',
            'Within 20% - reasonable accuracy but significant month-to-month variations',
            'Within 30% - poor predictability making planning difficult',
            'Cannot predict - cash flow highly volatile and unpredictable'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '2.1-followup-1',
              type: 'text',
              question: 'What are the main sources of cash flow unpredictability?',
              required: false,
              conditional: { dependsOn: '2.1', showIf: ['Within 30% - poor predictability making planning difficult', 'Cannot predict - cash flow highly volatile and unpredictable'] }
            }
          ]
        },
        {
          id: '2.2',
          type: 'multiple-choice',
          question: 'How detailed and scenario-based is your financial planning process?',
          options: [
            'Advanced - multiple scenarios with sensitivity analysis and Monte Carlo modeling',
            'Sophisticated - base/optimistic/pessimistic scenarios with regular updates',
            'Standard - annual budgets with quarterly reviews and basic scenario planning',
            'Basic - simple budgets without scenario planning or regular updates',
            'Minimal - reactive financial management without formal planning process'
          ],
          required: true
        },
        {
          id: '2.3',
          type: 'multiple-choice',
          question: 'How well does leadership understand unit economics across all business lines?',
          options: [
            'Expert level - granular unit economics drive all business decisions',
            'Advanced level - strong understanding with regular optimization efforts',
            'Good level - basic unit economics tracked but not consistently optimized',
            'Limited level - unit economics understood conceptually but not tracked systematically',
            'Poor level - little to no understanding of true unit economics'
          ],
          required: true
        },
        {
          id: '2.4',
          type: 'multiple-choice',
          question: 'How effectively does your organization allocate capital across growth opportunities?',
          options: [
            'Highly effective - systematic ROI analysis drives all capital allocation',
            'Very effective - strong processes with occasional suboptimal decisions',
            'Moderately effective - reasonable processes but inconsistent execution',
            'Somewhat effective - ad hoc capital allocation with limited analysis',
            'Ineffective - capital allocation driven by politics or intuition rather than analysis'
          ],
          required: true
        },
        {
          id: '2.5',
          type: 'multiple-choice',
          question: 'How well optimized is your working capital management (inventory, receivables, payables)?',
          options: [
            'Highly optimized - sophisticated working capital management creates competitive advantage',
            'Well optimized - efficient processes with regular optimization efforts',
            'Adequately managed - standard practices without significant inefficiencies',
            'Poorly managed - significant working capital tied up unnecessarily',
            'Very poor - working capital management creates cash flow problems'
          ],
          required: true
        },
        {
          id: '2.6',
          type: 'multiple-choice',
          question: 'How robust are your financial controls and risk management processes?',
          options: [
            'Enterprise-grade - comprehensive controls with automated monitoring and alerts',
            'Strong controls - solid processes with regular audits and improvements',
            'Adequate controls - basic controls in place meeting minimum requirements',
            'Weak controls - minimal controls creating risk exposure',
            'Poor controls - significant control gaps creating operational and compliance risks'
          ],
          required: true
        },
        {
          id: '2.7',
          type: 'multiple-choice',
          question: 'How effectively do you measure ROI on growth investments (marketing, sales, product)?',
          options: [
            'Sophisticated tracking - granular ROI measurement with attribution modeling',
            'Good tracking - clear ROI metrics with regular optimization',
            'Basic tracking - simple ROI measurement without detailed attribution',
            'Limited tracking - ROI measured occasionally or at high level only',
            'No tracking - growth investments made without systematic ROI measurement'
          ],
          required: true
        },
        {
          id: '2.8',
          type: 'multiple-choice',
          question: 'How well do your financial systems support your current scale and growth plans?',
          options: [
            'Excellent - enterprise-grade systems with full integration and automation',
            'Good - solid systems meeting current needs with clear upgrade path',
            'Adequate - systems work but have limitations affecting efficiency',
            'Poor - systems create bottlenecks and require significant manual work',
            'Inadequate - systems cannot support current operations effectively'
          ],
          required: false,
          industrySpecific: {
            companyStages: ['growth', 'mature'],
            minRevenue: '£10M'
          }
        },
        {
          id: '2.9',
          type: 'multiple-choice',
          question: 'How effectively does your organization manage regulatory capital requirements?',
          options: [
            'Expert management - regulatory capital optimized as competitive advantage',
            'Strong management - efficient compliance with minimal excess capital',
            'Adequate management - meets requirements but not optimized',
            'Struggling - difficulty meeting requirements or significant over-capitalization',
            'Poor management - regulatory capital issues affecting business operations'
          ],
          required: false,
          industrySpecific: {
            regulated: true
          }
        }
      ],

      'revenue-engine': [
        {
          id: '3.1',
          type: 'multiple-choice',
          question: 'How accurately can you predict quarterly revenue 2 quarters in advance?',
          options: [
            'Within 5% - highly predictable revenue with strong pipeline visibility',
            'Within 10% - good predictability with minor seasonal or market variations',
            'Within 15% - reasonable accuracy but some unpredictable elements',
            'Within 25% - poor predictability making growth planning difficult',
            'Cannot predict - revenue highly volatile and unpredictable'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '3.1-followup-1',
              type: 'text',
              question: 'What are the main sources of revenue unpredictability?',
              required: false,
              conditional: { dependsOn: '3.1', showIf: ['Within 25% - poor predictability making growth planning difficult', 'Cannot predict - revenue highly volatile and unpredictable'] }
            }
          ]
        },
        {
          id: '3.2',
          type: 'multiple-choice',
          question: 'How well optimized and documented is your sales process from lead to close?',
          options: [
            'Highly optimized - data-driven sales process with continuous optimization',
            'Well optimized - clear process with regular improvements based on performance data',
            'Moderately optimized - documented process but limited optimization efforts',
            'Basic process - informal process with minimal documentation or optimization',
            'No clear process - sales happens ad hoc without systematic approach'
          ],
          required: true
        },
        {
          id: '3.3',
          type: 'multiple-choice',
          question: 'How effectively do you manage and optimize customer acquisition costs across channels?',
          options: [
            'Expert level - sophisticated CAC optimization with channel attribution and LTV modeling',
            'Advanced level - strong CAC tracking with regular optimization across channels',
            'Good level - basic CAC tracking for main channels with some optimization',
            'Limited level - high-level CAC tracking without detailed channel analysis',
            'Poor level - little to no systematic CAC tracking or optimization'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '3.3-followup-1',
              type: 'multiple-select',
              question: 'Which channels have the highest/most unpredictable CAC?',
              options: ['Paid search', 'Social media', 'Content marketing', 'Events', 'Referrals', 'Direct sales', 'Partnerships'],
              required: false,
              conditional: { dependsOn: '3.3', showIf: ['Limited level - high-level CAC tracking without detailed channel analysis', 'Poor level - little to no systematic CAC tracking or optimization'] }
            }
          ]
        },
        {
          id: '3.4',
          type: 'multiple-choice',
          question: 'How well diversified is your revenue across customers, products, and channels?',
          options: [
            'Excellent diversification - no single point of failure, resilient revenue base',
            'Good diversification - reasonable spread with acceptable concentration risk',
            'Moderate diversification - some concentration but manageable risk levels',
            'Poor diversification - significant concentration creating business risk',
            'High concentration - dangerous dependence on single customer/product/channel'
          ],
          required: true
        },
        {
          id: '3.5',
          type: 'multiple-choice',
          question: 'How effective and scalable are your lead generation systems?',
          options: [
            'Highly effective - consistent, scalable lead generation across multiple channels',
            'Very effective - reliable lead flow with occasional optimization needed',
            'Moderately effective - decent lead generation but not consistently scalable',
            'Somewhat effective - inconsistent lead generation requiring constant attention',
            'Ineffective - poor lead generation creating sales pipeline problems'
          ],
          required: true
        },
        {
          id: '3.6',
          type: 'multiple-choice',
          question: 'How effectively do you manage and develop sales team performance?',
          options: [
            'Expert management - data-driven performance management with continuous coaching',
            'Strong management - clear metrics and regular performance development',
            'Adequate management - basic performance tracking with some development efforts',
            'Weak management - limited performance management and development',
            'Poor management - minimal performance oversight or team development'
          ],
          required: true
        },
        {
          id: '3.7',
          type: 'multiple-choice',
          question: 'How sophisticated are your revenue operations (sales/marketing alignment, data analysis)?',
          options: [
            'Advanced RevOps - seamless sales/marketing integration with sophisticated analytics',
            'Good RevOps - solid integration with regular data-driven optimization',
            'Basic RevOps - some integration efforts but limited analytical sophistication',
            'Minimal RevOps - poor sales/marketing alignment with limited data analysis',
            'No RevOps - sales and marketing operate independently without integration'
          ],
          required: true
        },
        {
          id: '3.8',
          type: 'multiple-choice',
          question: 'How effectively do you grow revenue from existing customers?',
          options: [
            'Expert expansion - systematic expansion programs driving 30%+ revenue growth from existing customers',
            'Strong expansion - consistent expansion efforts contributing 20-30% revenue growth',
            'Moderate expansion - some expansion success contributing 10-20% revenue growth',
            'Limited expansion - minimal expansion success contributing <10% revenue growth',
            'No expansion - purely acquisition-focused with minimal existing customer growth'
          ],
          required: false,
          industrySpecific: {
            businessModels: ['b2b-saas', 'b2c-marketplace', 'services']
          }
        },
        {
          id: '3.9',
          type: 'multiple-choice',
          question: 'How proactive and systematic is your customer success function?',
          options: [
            'Proactive excellence - predictive customer success with health scoring and automated interventions',
            'Strong proactive approach - systematic customer success with regular health monitoring',
            'Moderately proactive - some proactive efforts but mostly reactive customer management',
            'Mostly reactive - customer success responds to issues but limited proactive efforts',
            'Purely reactive - customer success only engages when customers escalate problems'
          ],
          required: false,
          industrySpecific: {
            businessModels: ['b2b-saas', 'services']
          }
        }
      ],

      'operational-excellence': [
        {
          id: '4.1',
          type: 'multiple-choice',
          question: 'How well documented and standardized are your core business processes?',
          options: [
            'Comprehensive - all critical processes documented with regular updates and training',
            'Well documented - most processes documented with good standardization',
            'Partially documented - key processes documented but gaps exist',
            'Minimally documented - few processes documented, mostly tribal knowledge',
            'Undocumented - processes exist in people\'s heads, no standardization'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '4.1-followup-1',
              type: 'text',
              question: 'What happens when key team members are unavailable?',
              required: false,
              conditional: { dependsOn: '4.1', showIf: ['Minimally documented - few processes documented, mostly tribal knowledge', 'Undocumented - processes exist in people\'s heads, no standardization'] }
            }
          ]
        },
        {
          id: '4.2',
          type: 'multiple-choice',
          question: 'How systematically do you identify and eliminate operational inefficiencies?',
          options: [
            'Continuous optimization - systematic process improvement with data-driven optimization',
            'Regular optimization - scheduled process reviews with improvement implementation',
            'Periodic optimization - occasional process improvement efforts',
            'Minimal optimization - process improvement happens reactively when problems arise',
            'No optimization - processes remain static without systematic improvement efforts'
          ],
          required: true
        },
        {
          id: '4.3',
          type: 'multiple-choice',
          question: 'How effective are your quality control and error prevention systems?',
          options: [
            'Proactive quality systems - predictive quality control with automated monitoring',
            'Strong quality control - systematic quality processes with regular monitoring',
            'Basic quality control - standard quality processes meeting minimum requirements',
            'Reactive quality control - quality issues addressed after they occur',
            'Poor quality control - frequent quality issues affecting customer satisfaction'
          ],
          required: true
        },
        {
          id: '4.4',
          type: 'multiple-choice',
          question: 'How well can your current operational processes handle 2-3x growth?',
          options: [
            'Highly scalable - processes designed for growth with automation and flexibility',
            'Mostly scalable - processes can handle growth with minor adjustments',
            'Moderately scalable - some processes will need updates for significant growth',
            'Limited scalability - many processes will break or become inefficient with growth',
            'Not scalable - current processes cannot handle significant growth without complete redesign'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '4.4-followup-1',
              type: 'multiple-select',
              question: 'Which processes are most likely to break first during growth?',
              options: ['Customer onboarding', 'Order fulfillment', 'Quality control', 'Communications', 'Reporting', 'Team coordination', 'Decision making'],
              required: false,
              conditional: { dependsOn: '4.4', showIf: ['Limited scalability - many processes will break or become inefficient with growth', 'Not scalable - current processes cannot handle significant growth without complete redesign'] }
            }
          ]
        },
        {
          id: '4.5',
          type: 'multiple-choice',
          question: 'How effectively do different departments coordinate on shared processes?',
          options: [
            'Seamless coordination - excellent cross-department integration with clear handoffs',
            'Good coordination - solid cross-department processes with minor friction',
            'Adequate coordination - coordination works but requires active management',
            'Poor coordination - significant friction and inefficiencies between departments',
            'Broken coordination - departments operate in silos causing operational problems'
          ],
          required: true
        },
        {
          id: '4.6',
          type: 'multiple-choice',
          question: 'How comprehensive and actionable are your operational performance metrics?',
          options: [
            'Advanced metrics - comprehensive KPI dashboard with predictive analytics',
            'Good metrics - solid KPI tracking with regular performance reviews',
            'Basic metrics - standard metrics tracked but limited analytical insights',
            'Minimal metrics - few metrics tracked, limited performance visibility',
            'No systematic metrics - operational performance not systematically measured'
          ],
          required: true
        },
        {
          id: '4.7',
          type: 'multiple-choice',
          question: 'How well integrated and automated are your operational tools and systems?',
          options: [
            'Highly automated - sophisticated automation with seamless tool integration',
            'Well automated - good automation with most tools integrated effectively',
            'Partially automated - some automation but many manual processes remain',
            'Minimally automated - limited automation, mostly manual operations',
            'Manual operations - little to no automation, heavy reliance on manual processes'
          ],
          required: true
        },
        {
          id: '4.8',
          type: 'multiple-choice',
          question: 'How standardized and efficient is your service delivery process?',
          options: [
            'Highly standardized - consistent, efficient service delivery with quality guarantees',
            'Well standardized - good service consistency with regular quality monitoring',
            'Partially standardized - basic standards but some variation in delivery',
            'Minimally standardized - service delivery varies significantly by team/individual',
            'Unstandardized - service delivery completely dependent on individual approaches'
          ],
          required: false,
          industrySpecific: {
            businessModels: ['services', 'b2c-marketplace']
          }
        }
      ],

      'people-organization': [
        {
          id: '5.1',
          type: 'multiple-choice',
          question: 'How effective is your ability to attract and retain top talent?',
          options: [
            'Excellent - consistent ability to attract top talent with low voluntary turnover',
            'Very good - strong employer brand with good retention rates',
            'Adequate - can fill positions but faces some retention challenges',
            'Struggling - difficulty attracting quality talent or high turnover rates',
            'Poor - significant talent challenges affecting business operations'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '5.1-followup-1',
              type: 'multiple-select',
              question: 'What are your biggest talent challenges?',
              options: ['Attracting candidates', 'Competitive compensation', 'Cultural fit', 'Skills gaps', 'Career development', 'Work-life balance', 'Remote work policies'],
              required: false,
              conditional: { dependsOn: '5.1', showIf: ['Struggling - difficulty attracting quality talent or high turnover rates', 'Poor - significant talent challenges affecting business operations'] }
            }
          ]
        },
        {
          id: '5.2',
          type: 'multiple-choice',
          question: 'How strong and aligned is your organizational culture?',
          options: [
            'Exceptional culture - high engagement with strong cultural alignment driving performance',
            'Strong culture - good cultural foundation with high employee satisfaction',
            'Developing culture - positive culture but inconsistent across the organization',
            'Weak culture - cultural issues affecting morale and performance',
            'Toxic culture - negative cultural elements creating significant business problems'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '5.2-followup-1',
              type: 'text',
              question: 'What specific cultural issues are affecting business performance?',
              required: false,
              conditional: { dependsOn: '5.2', showIf: ['Weak culture - cultural issues affecting morale and performance', 'Toxic culture - negative cultural elements creating significant business problems'] }
            }
          ]
        },
        {
          id: '5.3',
          type: 'multiple-choice',
          question: 'How effectively do you develop future leaders within the organization?',
          options: [
            'Sophisticated program - systematic leadership development with clear succession planning',
            'Good development - regular leadership training with some succession planning',
            'Basic development - occasional leadership training without systematic succession planning',
            'Limited development - minimal leadership development efforts',
            'No development - no systematic leadership development or succession planning'
          ],
          required: true
        },
        {
          id: '5.4',
          type: 'multiple-choice',
          question: 'How effective is your performance management and feedback system?',
          options: [
            'Advanced system - continuous performance management with data-driven insights',
            'Good system - regular performance reviews with clear improvement planning',
            'Standard system - annual/semi-annual reviews with basic feedback',
            'Weak system - infrequent or ineffective performance management',
            'No system - minimal performance feedback or management'
          ],
          required: true
        },
        {
          id: '5.5',
          type: 'multiple-choice',
          question: 'How systematically do you develop employee skills and capabilities?',
          options: [
            'Strategic development - comprehensive training programs aligned with business strategy',
            'Good development - regular training with individual development plans',
            'Basic development - some training opportunities but not systematic',
            'Minimal development - limited training mainly for compliance or basic skills',
            'No development - minimal investment in employee skill development'
          ],
          required: true
        },
        {
          id: '5.6',
          type: 'multiple-choice',
          question: 'How effectively does information flow throughout the organization?',
          options: [
            'Excellent communication - transparent, timely information sharing at all levels',
            'Good communication - regular communication with minor information gaps',
            'Adequate communication - communication works but could be more effective',
            'Poor communication - significant information silos and communication gaps',
            'Broken communication - information doesn\'t flow effectively, creating operational problems'
          ],
          required: true
        },
        {
          id: '5.7',
          type: 'multiple-choice',
          question: 'How effectively does your organization adapt to change?',
          options: [
            'Highly agile - organization embraces change with systematic change management',
            'Quite agile - good change adaptation with effective change management processes',
            'Moderately agile - can adapt to change but requires significant management effort',
            'Low agility - organization struggles with change, requiring extensive change management',
            'Change resistant - organization resists change, making adaptation very difficult'
          ],
          required: true
        },
        {
          id: '5.8',
          type: 'multiple-choice',
          question: 'How effective is your middle management layer at executing strategy and developing teams?',
          options: [
            'Highly effective - middle managers are strong strategic executors and team developers',
            'Very effective - good middle management with occasional development needs',
            'Moderately effective - middle management adequate but inconsistent',
            'Somewhat effective - middle management struggles with strategy execution or team development',
            'Ineffective - middle management layer creates bottlenecks and execution problems'
          ],
          required: false,
          industrySpecific: {
            companyStages: ['growth', 'mature'],
            minEmployees: 50
          }
        },
        {
          id: '5.9',
          type: 'multiple-choice',
          question: 'How effectively have you maintained culture and integrated new hires during rapid growth?',
          options: [
            'Excellent integration - culture remains strong with seamless new hire integration',
            'Good integration - culture mostly maintained with effective onboarding',
            'Adequate integration - some cultural dilution but manageable integration',
            'Poor integration - significant cultural challenges and integration problems',
            'Failed integration - rapid growth has damaged culture and created integration crisis'
          ],
          required: false,
          industrySpecific: {
            rapidGrowth: true
          }
        }
      ],

      'technology-data': [
        {
          id: '6.1',
          type: 'multiple-choice',
          question: 'How well can your current technology infrastructure support 3x business growth?',
          options: [
            'Highly scalable - technology designed for growth with auto-scaling and redundancy',
            'Mostly scalable - technology can handle growth with minor upgrades',
            'Moderately scalable - some technology updates needed for significant growth',
            'Limited scalability - major technology investments required for growth',
            'Not scalable - current technology cannot support significant growth'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '6.1-followup-1',
              type: 'text',
              question: 'What specific technology constraints are limiting growth?',
              required: false,
              conditional: { dependsOn: '6.1', showIf: ['Limited scalability - major technology investments required for growth', 'Not scalable - current technology cannot support significant growth'] }
            }
          ]
        },
        {
          id: '6.2',
          type: 'multiple-choice',
          question: 'How reliable and accessible is business-critical data across your organization?',
          options: [
            'Excellent data - high-quality, real-time data accessible to all decision-makers',
            'Good data - reliable data with good accessibility and minor quality issues',
            'Adequate data - reasonable data quality with some accessibility challenges',
            'Poor data - significant data quality or accessibility problems',
            'Terrible data - unreliable data hampering decision-making across the organization'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '6.2-followup-1',
              type: 'multiple-select',
              question: 'Which business functions are most affected by data issues?',
              options: ['Sales forecasting', 'Financial reporting', 'Customer analytics', 'Operations monitoring', 'Marketing attribution', 'Product development', 'Risk assessment'],
              required: false,
              conditional: { dependsOn: '6.2', showIf: ['Poor data - significant data quality or accessibility problems', 'Terrible data - unreliable data hampering decision-making across the organization'] }
            }
          ]
        },
        {
          id: '6.3',
          type: 'multiple-choice',
          question: 'How well integrated are your business systems and workflows?',
          options: [
            'Fully integrated - seamless system integration with comprehensive workflow automation',
            'Well integrated - good system integration with substantial automation',
            'Partially integrated - some integration but significant manual processes remain',
            'Poorly integrated - systems operate independently with minimal automation',
            'Fragmented - systems don\'t integrate, requiring extensive manual data transfer'
          ],
          required: true
        },
        {
          id: '6.4',
          type: 'multiple-choice',
          question: 'How robust is your technology security and compliance posture?',
          options: [
            'Enterprise-grade - comprehensive security with automated compliance monitoring',
            'Strong security - solid security practices with good compliance management',
            'Adequate security - basic security meeting minimum requirements',
            'Weak security - security gaps creating risk exposure',
            'Poor security - significant security vulnerabilities affecting business operations'
          ],
          required: true
        },
        {
          id: '6.5',
          type: 'multiple-choice',
          question: 'How sophisticated are your business intelligence and analytics capabilities?',
          options: [
            'Advanced analytics - predictive analytics with real-time business intelligence',
            'Good analytics - solid BI tools with regular analytical insights',
            'Basic analytics - standard reporting with limited analytical capabilities',
            'Minimal analytics - basic reporting without significant analytical insights',
            'No analytics - minimal business intelligence or analytical capabilities'
          ],
          required: true
        },
        {
          id: '6.6',
          type: 'multiple-choice',
          question: 'How capable is your internal technology team at supporting business needs?',
          options: [
            'Highly capable - strong internal team with expertise across all business technology needs',
            'Very capable - good internal team with occasional external expertise needed',
            'Adequately capable - competent team but limited in some areas',
            'Limited capability - team struggles to support all business technology needs',
            'Insufficient capability - technology team cannot adequately support business operations'
          ],
          required: true
        },
        {
          id: '6.7',
          type: 'multiple-choice',
          question: 'How effectively does your organization leverage technology for competitive advantage?',
          options: [
            'Innovation leader - technology creates significant competitive advantages',
            'Strong innovation - technology provides clear business benefits and differentiation',
            'Moderate innovation - technology supports business but doesn\'t create competitive advantage',
            'Limited innovation - technology mainly supports existing processes without innovation',
            'Technology laggard - technology holds back business innovation and competitiveness'
          ],
          required: true
        },
        {
          id: '6.8',
          type: 'multiple-choice',
          question: 'How well does your technology infrastructure support regulatory compliance requirements?',
          options: [
            'Compliance-optimized - technology infrastructure designed for regulatory efficiency',
            'Strong compliance - technology well-suited for regulatory requirements',
            'Adequate compliance - technology meets regulatory requirements but not optimized',
            'Compliance struggles - technology makes regulatory compliance difficult or expensive',
            'Compliance risk - technology infrastructure creates regulatory compliance risks'
          ],
          required: false,
          industrySpecific: {
            regulated: true
          }
        }
      ],

      'customer-experience': [
        {
          id: '7.1',
          type: 'multiple-choice',
          question: 'How satisfied and loyal are your customers compared to industry standards?',
          options: [
            'Exceptional satisfaction - industry-leading satisfaction with high loyalty and advocacy',
            'High satisfaction - strong customer satisfaction with good retention rates',
            'Adequate satisfaction - reasonable satisfaction meeting industry averages',
            'Below average satisfaction - customer satisfaction below industry standards',
            'Poor satisfaction - significant customer satisfaction problems affecting retention'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '7.1-followup-1',
              type: 'text',
              question: 'What are the primary drivers of customer dissatisfaction?',
              required: false,
              conditional: { dependsOn: '7.1', showIf: ['Below average satisfaction - customer satisfaction below industry standards', 'Poor satisfaction - significant customer satisfaction problems affecting retention'] }
            }
          ]
        },
        {
          id: '7.2',
          type: 'multiple-choice',
          question: 'How strong is your product-market fit across your customer segments?',
          options: [
            'Exceptional fit - strong product-market fit with high customer demand and low churn',
            'Strong fit - good product-market fit with satisfied customers and reasonable retention',
            'Moderate fit - decent product-market fit but opportunities for improvement',
            'Weak fit - product-market fit challenges affecting growth and retention',
            'Poor fit - significant product-market fit problems requiring major changes'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '7.2-followup-1',
              type: 'text',
              question: 'Which customer segments have the weakest product-market fit?',
              required: false,
              conditional: { dependsOn: '7.2', showIf: ['Weak fit - product-market fit challenges affecting growth and retention', 'Poor fit - significant product-market fit problems requiring major changes'] }
            }
          ]
        },
        {
          id: '7.3',
          type: 'multiple-choice',
          question: 'How effectively do you collect and act on customer feedback?',
          options: [
            'Systematic integration - comprehensive feedback collection with rapid product/service integration',
            'Good integration - regular feedback collection with consistent improvement implementation',
            'Basic integration - some feedback collection with occasional improvements',
            'Limited integration - minimal feedback collection or slow improvement implementation',
            'No integration - customer feedback not systematically collected or acted upon'
          ],
          required: true
        },
        {
          id: '7.4',
          type: 'multiple-choice',
          question: 'How quickly and effectively do you develop and launch new products/features?',
          options: [
            'Rapid, high-quality development - fast development cycles with excellent quality and market fit',
            'Good development pace - reasonable development speed with good quality',
            'Moderate development - acceptable development speed and quality',
            'Slow development - development cycles too slow for market needs',
            'Poor development - slow development with quality problems affecting customer satisfaction'
          ],
          required: true
        },
        {
          id: '7.5',
          type: 'multiple-choice',
          question: 'How well optimized is the customer journey from awareness to advocacy?',
          options: [
            'Highly optimized - seamless, delightful customer journey driving high conversion and advocacy',
            'Well optimized - smooth customer journey with good conversion rates',
            'Moderately optimized - decent customer journey with room for improvement',
            'Poorly optimized - customer journey has friction points affecting conversion',
            'Not optimized - customer journey creates barriers to conversion and satisfaction'
          ],
          required: true
        },
        {
          id: '7.6',
          type: 'multiple-choice',
          question: 'How effective and efficient is your customer support function?',
          options: [
            'World-class support - proactive, efficient support creating competitive advantage',
            'Excellent support - responsive, helpful support with high customer satisfaction',
            'Good support - adequate support meeting customer expectations',
            'Poor support - support issues affecting customer satisfaction and retention',
            'Terrible support - support problems significantly damaging customer relationships'
          ],
          required: true
        },
        {
          id: '7.7',
          type: 'multiple-choice',
          question: 'How effectively do you innovate to maintain competitive differentiation?',
          options: [
            'Innovation leader - consistent innovation creating strong competitive moats',
            'Strong innovator - regular innovation maintaining competitive advantages',
            'Moderate innovation - some innovation but not consistently differentiating',
            'Slow innovation - innovation pace falling behind competitive needs',
            'Innovation laggard - insufficient innovation allowing competitors to gain advantages'
          ],
          required: true
        },
        {
          id: '7.8',
          type: 'multiple-choice',
          question: 'How strong is your brand and overall customer experience compared to competitors?',
          options: [
            'Premium brand - industry-leading brand with exceptional customer experience',
            'Strong brand - well-regarded brand with consistently good customer experience',
            'Decent brand - adequate brand recognition with reasonable customer experience',
            'Weak brand - limited brand recognition with customer experience issues',
            'Poor brand - negative brand perception with poor customer experience'
          ],
          required: false,
          industrySpecific: {
            businessModels: ['b2c-marketplace', 'retail']
          }
        }
      ],

      'supply-chain': [
        {
          id: '8.1',
          type: 'multiple-choice',
          question: 'How reliable and resilient is your supply chain to disruptions?',
          options: [
            'Highly resilient - diversified supply chain with excellent risk management',
            'Very resilient - strong supply chain with good contingency planning',
            'Moderately resilient - adequate supply chain with some risk management',
            'Somewhat vulnerable - supply chain has significant risk exposure',
            'Highly vulnerable - supply chain disruptions regularly affect business operations'
          ],
          required: true
        },
        {
          id: '8.2',
          type: 'multiple-choice',
          question: 'How well optimized is your inventory management across the supply chain?',
          options: [
            'Highly optimized - sophisticated inventory management minimizing costs while ensuring availability',
            'Well optimized - good inventory management with occasional optimization opportunities',
            'Adequately managed - reasonable inventory management meeting basic needs',
            'Poorly managed - inventory management creates cost or availability problems',
            'Unmanaged - inventory problems significantly affecting operations and customer satisfaction'
          ],
          required: true
        },
        {
          id: '8.3',
          type: 'multiple-choice',
          question: 'How effectively do you manage and develop supplier relationships?',
          options: [
            'Strategic partnerships - suppliers are true partners contributing to competitive advantage',
            'Strong relationships - good supplier management with collaborative relationships',
            'Adequate relationships - basic supplier management meeting operational needs',
            'Poor relationships - supplier management creates operational inefficiencies',
            'Problematic relationships - supplier issues regularly disrupt business operations'
          ],
          required: true
        },
        {
          id: '8.4',
          type: 'multiple-choice',
          question: 'How efficient are your manufacturing or operational processes?',
          options: [
            'World-class efficiency - industry-leading operational efficiency creating competitive advantage',
            'High efficiency - strong operational efficiency with regular improvement efforts',
            'Good efficiency - adequate operational efficiency meeting industry standards',
            'Poor efficiency - operational inefficiencies affecting costs and competitiveness',
            'Very poor efficiency - significant operational problems affecting business viability'
          ],
          required: true
        },
        {
          id: '8.5',
          type: 'multiple-choice',
          question: 'How robust are your quality control systems throughout operations?',
          options: [
            'Exceptional quality - comprehensive quality systems creating competitive differentiation',
            'Strong quality - robust quality control with consistent high-quality outputs',
            'Adequate quality - basic quality control meeting customer expectations',
            'Poor quality - quality issues affecting customer satisfaction and costs',
            'Quality problems - significant quality issues damaging customer relationships and profitability'
          ],
          required: true
        },
        {
          id: '8.6',
          type: 'multiple-choice',
          question: 'How effectively do you manage the complexities of international supply chains?',
          options: [
            'Expert management - sophisticated global supply chain providing competitive advantages',
            'Strong management - effective international supply chain management',
            'Adequate management - international supply chain works but not optimized',
            'Poor management - international complexity creates operational challenges',
            'Struggling - international supply chain problems affecting business operations'
          ],
          required: false,
          industrySpecific: {
            hasInternationalOperations: true
          }
        }
      ],

      'risk-compliance': [
        {
          id: '9.1',
          type: 'multiple-choice',
          question: 'How comprehensively do you identify and assess business risks?',
          options: [
            'Sophisticated risk management - comprehensive risk identification with quantitative assessment',
            'Good risk management - systematic risk identification with regular assessment',
            'Basic risk management - key risks identified with periodic assessment',
            'Limited risk management - minimal risk identification or assessment',
            'No systematic risk management - risks not systematically identified or managed'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '9.1-followup-1',
              type: 'text',
              question: 'What types of risks have surprised your organization in the past?',
              required: false,
              conditional: { dependsOn: '9.1', showIf: ['Limited risk management - minimal risk identification or assessment', 'No systematic risk management - risks not systematically identified or managed'] }
            }
          ]
        },
        {
          id: '9.2',
          type: 'multiple-choice',
          question: 'How effective is your system for managing regulatory and legal compliance?',
          options: [
            'Proactive compliance - comprehensive compliance management creating competitive advantages',
            'Strong compliance - systematic compliance with good monitoring and updating',
            'Adequate compliance - basic compliance meeting legal requirements',
            'Reactive compliance - compliance managed reactively with occasional gaps',
            'Poor compliance - compliance gaps creating legal or regulatory risks'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '9.2-followup-1',
              type: 'text',
              question: 'Which compliance areas are most challenging to manage?',
              required: false,
              conditional: { dependsOn: '9.2', showIf: ['Reactive compliance - compliance managed reactively with occasional gaps', 'Poor compliance - compliance gaps creating legal or regulatory risks'] }
            }
          ]
        },
        {
          id: '9.3',
          type: 'multiple-choice',
          question: 'How prepared is your organization for business continuity during disruptions?',
          options: [
            'Excellent preparedness - comprehensive business continuity plans with regular testing',
            'Good preparedness - solid business continuity planning with periodic testing',
            'Basic preparedness - basic business continuity plans in place',
            'Limited preparedness - minimal business continuity planning',
            'No preparedness - no systematic business continuity planning'
          ],
          required: true
        },
        {
          id: '9.4',
          type: 'multiple-choice',
          question: 'How effectively do you identify and manage financial risks?',
          options: [
            'Sophisticated financial risk management - comprehensive identification and mitigation',
            'Good financial risk management - systematic approach with regular monitoring',
            'Basic financial risk management - key financial risks managed',
            'Limited financial risk management - minimal financial risk oversight',
            'Poor financial risk management - financial risks not systematically managed'
          ],
          required: true
        },
        {
          id: '9.5',
          type: 'multiple-choice',
          question: 'How robust is your cybersecurity and data protection program?',
          options: [
            'Enterprise-grade cybersecurity - comprehensive security with proactive threat management',
            'Strong cybersecurity - solid security practices with regular updates and monitoring',
            'Adequate cybersecurity - basic security meeting minimum requirements',
            'Weak cybersecurity - security gaps creating risk exposure',
            'Poor cybersecurity - significant security vulnerabilities threatening business operations'
          ],
          required: true
        },
        {
          id: '9.6',
          type: 'multiple-choice',
          question: 'How appropriately do you use insurance and other risk transfer mechanisms?',
          options: [
            'Optimized risk transfer - sophisticated insurance strategy balancing cost and coverage',
            'Good risk transfer - appropriate insurance coverage with regular reviews',
            'Adequate risk transfer - basic insurance meeting key risk coverage needs',
            'Limited risk transfer - insufficient insurance or risk transfer mechanisms',
            'Poor risk transfer - inadequate insurance creating significant risk exposure'
          ],
          required: true
        },
        {
          id: '9.7',
          type: 'multiple-choice',
          question: 'How sophisticated is your regulatory compliance management?',
          options: [
            'Compliance excellence - regulatory compliance creates competitive advantages',
            'Strong compliance - sophisticated compliance management with proactive monitoring',
            'Adequate compliance - meets regulatory requirements with standard processes',
            'Compliance struggles - difficulty maintaining compliance requirements',
            'Compliance failures - regulatory compliance issues affecting business operations'
          ],
          required: false,
          industrySpecific: {
            regulated: true
          }
        }
      ],

      'partnerships': [
        {
          id: '10.1',
          type: 'multiple-choice',
          question: 'How effective is your portfolio of strategic partnerships in driving business value?',
          options: [
            'Exceptional partnerships - strategic partnerships create significant competitive advantages',
            'Strong partnerships - effective partnerships contributing meaningfully to business success',
            'Moderate partnerships - partnerships provide some value but not optimized',
            'Weak partnerships - partnerships exist but contribute minimal business value',
            'Poor partnerships - partnerships drain resources or create problems'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '10.1-followup-1',
              type: 'text',
              question: 'What prevents partnerships from delivering expected business value?',
              required: false,
              conditional: { dependsOn: '10.1', showIf: ['Weak partnerships - partnerships exist but contribute minimal business value', 'Poor partnerships - partnerships drain resources or create problems'] }
            }
          ]
        },
        {
          id: '10.2',
          type: 'multiple-choice',
          question: 'How effectively do you manage and develop partner relationships?',
          options: [
            'Advanced partner management - systematic partner development with mutual value creation',
            'Good partner management - solid partner relationships with regular communication',
            'Basic partner management - adequate partner management meeting minimum needs',
            'Poor partner management - partner relationships not effectively managed',
            'Neglected partnerships - partnerships exist but receive minimal management attention'
          ],
          required: true
        },
        {
          id: '10.3',
          type: 'multiple-choice',
          question: 'How well integrated are you within your industry ecosystem?',
          options: [
            'Ecosystem leader - central position in industry ecosystem influencing standards and direction',
            'Well integrated - strong ecosystem participation with influential relationships',
            'Moderately integrated - decent ecosystem participation but not influential',
            'Poorly integrated - limited ecosystem participation missing opportunities',
            'Isolated - minimal ecosystem integration limiting business opportunities'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '10.3-followup-1',
              type: 'text',
              question: 'What ecosystem opportunities is the organization missing?',
              required: false,
              conditional: { dependsOn: '10.3', showIf: ['Poorly integrated - limited ecosystem participation missing opportunities', 'Isolated - minimal ecosystem integration limiting business opportunities'] }
            }
          ]
        },
        {
          id: '10.4',
          type: 'multiple-choice',
          question: 'How effective are your channel partners in driving sales and customer success?',
          options: [
            'Exceptional channels - channel partners drive significant revenue with high satisfaction',
            'Strong channels - effective channel partners contributing meaningfully to growth',
            'Adequate channels - channel partners provide reasonable value',
            'Weak channels - channel partners contribute limited value or create problems',
            'Poor channels - channel relationships drain resources or damage brand'
          ],
          required: true
        },
        {
          id: '10.5',
          type: 'multiple-choice',
          question: 'How strategically do you manage relationships with key vendors and suppliers?',
          options: [
            'Strategic vendor management - vendors are true partners contributing to competitive advantage',
            'Good vendor management - effective vendor relationships with mutual value creation',
            'Adequate vendor management - vendor relationships meet operational needs',
            'Poor vendor management - vendor relationships create operational inefficiencies',
            'Problematic vendors - vendor issues regularly disrupt business operations'
          ],
          required: true
        },
        {
          id: '10.6',
          type: 'multiple-choice',
          question: 'How effectively do you leverage partnerships for innovation and technology advancement?',
          options: [
            'Innovation catalyst - partnerships accelerate innovation and provide technology advantages',
            'Good innovation partnerships - partnerships contribute meaningfully to innovation efforts',
            'Some innovation partnerships - partnerships provide occasional innovation value',
            'Limited innovation partnerships - partnerships don\'t significantly contribute to innovation',
            'No innovation partnerships - missing partnership opportunities for innovation and technology'
          ],
          required: true
        },
        {
          id: '10.7',
          type: 'multiple-choice',
          question: 'How effectively do you enable channel partners to sell and support your solutions?',
          options: [
            'Comprehensive enablement - world-class partner training, tools, and support',
            'Strong enablement - good partner support with effective training and resources',
            'Basic enablement - adequate partner support meeting minimum needs',
            'Poor enablement - partner support inadequate affecting their performance',
            'No enablement - partners receive minimal support limiting their effectiveness'
          ],
          required: false,
          industrySpecific: {
            hasChannelSales: true
          }
        }
      ],

      'customer-success': [
        {
          id: '11.1',
          type: 'multiple-choice',
          question: 'How effectively do you manage the complete customer lifecycle from onboarding to renewal?',
          options: [
            'Exceptional lifecycle management - systematic, proactive management driving high satisfaction and growth',
            'Strong lifecycle management - good customer journey management with consistent value delivery',
            'Adequate lifecycle management - basic lifecycle management meeting customer expectations',
            'Poor lifecycle management - lifecycle gaps affecting customer satisfaction and retention',
            'No systematic lifecycle management - customers managed reactively without systematic approach'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '11.1-followup-1',
              type: 'multiple-select',
              question: 'Which stages of the customer lifecycle have the biggest gaps?',
              options: ['Onboarding', 'Initial value delivery', 'Adoption', 'Expansion', 'Renewal', 'Support', 'Success management'],
              required: false,
              conditional: { dependsOn: '11.1', showIf: ['Poor lifecycle management - lifecycle gaps affecting customer satisfaction and retention', 'No systematic lifecycle management - customers managed reactively without systematic approach'] }
            }
          ]
        },
        {
          id: '11.2',
          type: 'multiple-choice',
          question: 'How proactively do you identify and address customer health and churn risks?',
          options: [
            'Predictive health management - sophisticated health scoring with proactive intervention',
            'Good health monitoring - systematic health tracking with regular intervention',
            'Basic health monitoring - some health indicators tracked with reactive intervention',
            'Limited health monitoring - minimal customer health visibility',
            'No health monitoring - customer health and risks not systematically tracked'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '11.2-followup-1',
              type: 'text',
              question: 'What typically causes customer health issues or churn?',
              required: false,
              conditional: { dependsOn: '11.2', showIf: ['Limited health monitoring - minimal customer health visibility', 'No health monitoring - customer health and risks not systematically tracked'] }
            }
          ]
        },
        {
          id: '11.3',
          type: 'multiple-choice',
          question: 'How effectively do you drive expansion revenue from existing customers?',
          options: [
            'Systematic expansion engine - sophisticated expansion programs driving significant growth',
            'Strong expansion efforts - consistent expansion success with good processes',
            'Moderate expansion - some expansion success but not systematic',
            'Limited expansion - minimal focus on customer expansion opportunities',
            'No expansion strategy - purely focused on retention without growth initiatives'
          ],
          required: true
        },
        {
          id: '11.4',
          type: 'multiple-choice',
          question: 'How effectively do you develop customer advocates and generate references?',
          options: [
            'Advocate engine - systematic advocate development driving significant business value',
            'Strong advocacy program - good advocate relationships providing regular business value',
            'Some advocacy efforts - occasional advocate development with limited systematic approach',
            'Limited advocacy - minimal focus on developing customer advocates',
            'No advocacy strategy - missing opportunities to leverage satisfied customers'
          ],
          required: true
        },
        {
          id: '11.5',
          type: 'multiple-choice',
          question: 'How effective is your customer success team at driving customer outcomes?',
          options: [
            'World-class customer success - industry-leading customer success driving exceptional outcomes',
            'Strong customer success - effective team with good customer outcome achievement',
            'Adequate customer success - team meets basic customer success needs',
            'Weak customer success - team struggles to drive consistent customer outcomes',
            'Poor customer success - team performance problems affecting customer relationships'
          ],
          required: true
        },
        {
          id: '11.6',
          type: 'multiple-choice',
          question: 'How effectively do you integrate customer feedback into product and service improvements?',
          options: [
            'Seamless integration - sophisticated feedback integration driving continuous improvement',
            'Good integration - regular feedback integration with product/service improvements',
            'Basic integration - some feedback integration but not systematic',
            'Limited integration - minimal feedback integration into improvements',
            'No integration - customer feedback not systematically integrated into business improvements'
          ],
          required: true
        },
        {
          id: '11.7',
          type: 'multiple-choice',
          question: 'How sophisticated are your churn prediction and prevention capabilities?',
          options: [
            'Advanced churn prevention - predictive analytics with proactive intervention reducing churn significantly',
            'Good churn prevention - solid churn prediction with effective intervention programs',
            'Basic churn prevention - some churn indicators tracked with reactive intervention',
            'Limited churn prevention - minimal churn prediction or prevention efforts',
            'No churn prevention - churn managed reactively without prediction or systematic prevention'
          ],
          required: false,
          industrySpecific: {
            businessModels: ['b2b-saas', 'b2c-marketplace']
          }
        }
      ],

      'change-management': [
        {
          id: '12.1',
          type: 'multiple-choice',
          question: 'How effectively does your organization plan and execute organizational changes?',
          options: [
            'Change management excellence - systematic change management with high success rates',
            'Strong change management - good change planning and execution with occasional challenges',
            'Adequate change management - basic change management meeting organizational needs',
            'Weak change management - change initiatives often struggle or fail',
            'Poor change management - organization cannot effectively execute significant changes'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '12.1-followup-1',
              type: 'text',
              question: 'What types of changes are most difficult for your organization?',
              required: false,
              conditional: { dependsOn: '12.1', showIf: ['Weak change management - change initiatives often struggle or fail', 'Poor change management - organization cannot effectively execute significant changes'] }
            }
          ]
        },
        {
          id: '12.2',
          type: 'multiple-choice',
          question: 'How effectively does your organization turn plans and strategies into executed results?',
          options: [
            'Implementation excellence - consistent translation of strategy into results with high success rates',
            'Strong implementation - good execution with most initiatives achieving intended results',
            'Adequate implementation - reasonable execution with mixed success rates',
            'Weak implementation - implementation struggles with many initiatives failing to achieve goals',
            'Poor implementation - significant gap between planning and execution'
          ],
          required: true,
          followUpQuestions: [
            {
              id: '12.2-followup-1',
              type: 'text',
              question: 'What\'s the biggest gap between planning and execution?',
              required: false,
              conditional: { dependsOn: '12.2', showIf: ['Weak implementation - implementation struggles with many initiatives failing to achieve goals', 'Poor implementation - significant gap between planning and execution'] }
            }
          ]
        },
        {
          id: '12.3',
          type: 'multiple-choice',
          question: 'How effectively do you communicate during periods of organizational change?',
          options: [
            'Exceptional change communication - transparent, timely communication creating buy-in and understanding',
            'Strong change communication - effective communication with good stakeholder engagement',
            'Adequate change communication - basic communication meeting minimum change management needs',
            'Poor change communication - communication gaps creating resistance and confusion',
            'Terrible change communication - communication problems significantly hampering change efforts'
          ],
          required: true
        },
        {
          id: '12.4',
          type: 'multiple-choice',
          question: 'How effectively do you secure stakeholder buy-in for organizational changes?',
          options: [
            'Expert stakeholder engagement - systematic stakeholder management creating strong change coalition',
            'Good stakeholder engagement - effective stakeholder management with strong buy-in',
            'Adequate stakeholder engagement - reasonable stakeholder management with some resistance',
            'Poor stakeholder engagement - stakeholder resistance creating change implementation problems',
            'Failed stakeholder engagement - stakeholder opposition preventing successful change implementation'
          ],
          required: true
        },
        {
          id: '12.5',
          type: 'multiple-choice',
          question: 'How effectively do you build organizational capabilities to support changes?',
          options: [
            'Comprehensive capability building - systematic training and development supporting all change initiatives',
            'Good capability building - effective training with good skill development supporting changes',
            'Basic capability building - adequate training meeting minimum change support needs',
            'Limited capability building - insufficient training hampering change implementation',
            'No capability building - lack of training and development preventing successful change implementation'
          ],
          required: true
        },
        {
          id: '12.6',
          type: 'multiple-choice',
          question: 'How effectively do you measure change progress and adjust implementation when needed?',
          options: [
            'Sophisticated change measurement - comprehensive metrics with rapid course correction',
            'Good change measurement - solid measurement systems with effective adjustments',
            'Basic change measurement - some measurement with occasional course corrections',
            'Limited change measurement - minimal measurement hampering effective change management',
            'No change measurement - changes implemented without systematic measurement or adjustment'
          ],
          required: true
        },
        {
          id: '12.7',
          type: 'multiple-choice',
          question: 'How ready is your organization to embrace and execute the changes needed for growth?',
          options: [
            'Highly change-ready - organization embraces change as competitive advantage',
            'Change-ready - organization adapts well to change with good change capacity',
            'Moderately change-ready - organization can handle change but requires significant management',
            'Change-resistant - organization struggles with change requiring extensive change management',
            'Change-adverse - organization actively resists change making growth initiatives very difficult'
          ],
          required: true
        },
        {
          id: '12.8',
          type: 'multiple-choice',
          question: 'How effectively do you manage the continuous changes required by rapid growth?',
          options: [
            'Growth change excellence - systematic approach to growth-driven change with minimal disruption',
            'Good growth change management - effective management of growth-related changes',
            'Adequate growth change management - growth changes managed but with significant effort',
            'Struggling with growth changes - growth-driven changes create organizational stress and problems',
            'Growth change crisis - organization cannot effectively manage the changes required by growth'
          ],
          required: false,
          industrySpecific: {
            rapidGrowth: true
          }
        }
      ]
    };

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(questionDatabase)
    };

  } catch (error) {
    console.error('Error retrieving questions:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};
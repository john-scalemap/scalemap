import { DomainTemplate, DomainName } from '../types/assessment';

export const domainDisplayNames: Record<DomainName, string> = {
  'strategic-alignment': 'Strategic Alignment & Vision',
  'financial-management': 'Financial Management',
  'revenue-engine': 'Revenue Engine',
  'operational-excellence': 'Operational Excellence',
  'people-organization': 'People & Organization',
  'technology-data': 'Technology & Data',
  'customer-experience': 'Customer Experience',
  'supply-chain': 'Supply Chain',
  'risk-compliance': 'Risk & Compliance',
  'partnerships': 'Partnerships',
  'customer-success': 'Customer Success',
  'change-management': 'Change Management',
};

export const assessmentDomains: DomainTemplate[] = [
  {
    domain: 'strategic-alignment',
    title: 'Strategic Alignment & Vision',
    description: 'Vision clarity, strategic priority alignment, and market positioning',
    questions: [
      {
        id: 'sa-1.1',
        type: 'scale',
        question: 'How clearly can your leadership team articulate your company\'s 3-year vision in one sentence?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Crystal clear - everyone gives the same answer',
            'Mostly clear - minor variations in wording',
            'Somewhat clear - general alignment but different emphases',
            'Unclear - significant variations in interpretation',
            'No clear vision - leadership gives contradictory answers'
          ]
        },
        required: true
      },
      {
        id: 'sa-1.2',
        type: 'scale',
        question: 'When making resource allocation decisions, how often do teams reference strategic priorities?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Always - every major decision includes strategic impact analysis',
            'Usually - strategic considerations are standard part of decisions',
            'Sometimes - strategic alignment happens for bigger decisions',
            'Rarely - decisions made mostly on operational needs',
            'Never - strategic priorities don\'t influence day-to-day resource allocation'
          ]
        },
        required: true
      },
      {
        id: 'sa-1.3',
        type: 'scale',
        question: 'How well do individual team goals connect to company-wide objectives?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Perfect alignment - every team goal clearly traces to strategic objectives',
            'Strong alignment - most goals connect with clear reasoning',
            'Moderate alignment - connections exist but aren\'t always clear',
            'Weak alignment - some teams have goals unrelated to strategy',
            'No alignment - team goals set independently of strategic objectives'
          ]
        },
        required: true
      },
      {
        id: 'sa-1.4',
        type: 'scale',
        question: 'How accurately does your leadership team assess your competitive position?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Highly accurate - deep market intelligence informs all strategic decisions',
            'Mostly accurate - good understanding with minor blind spots',
            'Moderately accurate - aware of main competitors but missing nuances',
            'Somewhat inaccurate - limited competitive intelligence',
            'Inaccurate - poor understanding of competitive landscape'
          ]
        },
        required: true
      }
    ],
    industrySpecific: {
      regulated: {
        additionalQuestions: [
          {
            id: 'sa-reg-1',
            type: 'scale',
            question: 'How well does your strategic vision account for regulatory changes?',
            scale: {
              min: 1,
              max: 5,
              labels: [
                'Proactive - strategy anticipates regulatory trends',
                'Responsive - strategy adapts quickly to regulatory changes',
                'Reactive - strategy responds to regulations after implementation',
                'Slow to adapt - regulatory changes create strategic delays',
                'Ignores regulations - strategy doesn\'t consider regulatory impact'
              ]
            },
            required: true
          }
        ],
        requiredFields: ['regulatory-compliance-officer']
      },
      nonRegulated: {
        skipQuestions: []
      }
    },
    companyStageVariations: {
      startup: {
        focusAreas: ['product-market-fit', 'initial-scaling'],
        questions: [
          {
            id: 'sa-startup-1',
            type: 'scale',
            question: 'How confident are you in your product-market fit?',
            scale: {
              min: 1,
              max: 5,
              labels: [
                'Strong PMF - clear demand and sustainable growth',
                'Good PMF - positive signals with room for improvement',
                'Moderate PMF - mixed signals, still optimizing',
                'Weak PMF - struggling to find consistent demand',
                'No PMF - significant pivots needed'
              ]
            },
            required: true
          }
        ]
      },
      growth: {
        focusAreas: ['scaling-operations', 'market-expansion'],
        questions: [
          {
            id: 'sa-growth-1',
            type: 'scale',
            question: 'How effectively are you scaling your business model?',
            scale: {
              min: 1,
              max: 5,
              labels: [
                'Excellent scaling - growth is sustainable and profitable',
                'Good scaling - growth with manageable growing pains',
                'Moderate scaling - growth but with operational challenges',
                'Struggling to scale - growth creating significant strain',
                'Poor scaling - growth is unsustainable'
              ]
            },
            required: true
          }
        ]
      },
      mature: {
        focusAreas: ['market-leadership', 'innovation'],
        questions: [
          {
            id: 'sa-mature-1',
            type: 'scale',
            question: 'How successfully are you driving innovation while maintaining market position?',
            scale: {
              min: 1,
              max: 5,
              labels: [
                'Innovation leader - setting industry standards',
                'Strong innovator - consistently introducing improvements',
                'Moderate innovation - keeping pace with market',
                'Slow innovation - falling behind market trends',
                'No innovation - maintaining status quo only'
              ]
            },
            required: true
          }
        ]
      }
    },
    scoringRules: {
      triggerThreshold: 4,
      criticalThreshold: 5,
      weightingFactors: {
        'vision-clarity': 1.5,
        'strategic-alignment': 1.3,
        'competitive-position': 1.2
      }
    }
  },
  {
    domain: 'financial-management',
    title: 'Financial Management',
    description: 'Financial planning, budgeting, cash flow management, and financial controls',
    questions: [
      {
        id: 'fm-2.1',
        type: 'scale',
        question: 'How accurate are your financial forecasts compared to actual results?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Highly accurate - consistently within 5% variance',
            'Mostly accurate - usually within 10% variance',
            'Moderately accurate - within 15% variance',
            'Somewhat inaccurate - 15-25% variance',
            'Inaccurate - regularly exceed 25% variance'
          ]
        },
        required: true
      },
      {
        id: 'fm-2.2',
        type: 'scale',
        question: 'How effectively do you manage cash flow and working capital?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Excellent - strong cash position with optimized working capital',
            'Good - healthy cash flow with minor optimization opportunities',
            'Adequate - cash flow managed but could be improved',
            'Concerning - occasional cash flow pressures',
            'Critical - frequent cash flow crises requiring urgent action'
          ]
        },
        required: true
      },
      {
        id: 'fm-2.3',
        type: 'scale',
        question: 'How comprehensive are your financial controls and approval processes?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Robust - comprehensive controls with clear approval hierarchies',
            'Strong - good controls with minor gaps',
            'Adequate - basic controls in place',
            'Weak - inconsistent controls with approval gaps',
            'Poor - minimal controls creating financial risk'
          ]
        },
        required: true
      }
    ],
    industrySpecific: {
      regulated: {
        additionalQuestions: [
          {
            id: 'fm-reg-1',
            type: 'scale',
            question: 'How well do you manage regulatory capital requirements?',
            scale: {
              min: 1,
              max: 5,
              labels: [
                'Excellent - consistently exceed requirements with buffer',
                'Good - meet requirements with comfortable margin',
                'Adequate - meet minimum requirements',
                'Concerning - occasionally struggle to meet requirements',
                'Critical - regularly fail to meet regulatory requirements'
              ]
            },
            required: true
          }
        ],
        requiredFields: ['regulatory-capital-ratio']
      },
      nonRegulated: {
        skipQuestions: []
      }
    },
    companyStageVariations: {
      startup: {
        focusAreas: ['runway-management', 'fundraising-readiness']
      },
      growth: {
        focusAreas: ['scaling-finance-operations', 'investment-management']
      },
      mature: {
        focusAreas: ['financial-optimization', 'investor-relations']
      }
    },
    scoringRules: {
      triggerThreshold: 4,
      criticalThreshold: 5,
      weightingFactors: {
        'cash-flow': 1.5,
        'forecasting-accuracy': 1.3,
        'financial-controls': 1.2
      }
    }
  },
  {
    domain: 'revenue-engine',
    title: 'Revenue Engine',
    description: 'Sales processes, marketing effectiveness, customer acquisition, and revenue growth',
    questions: [
      {
        id: 're-3.1',
        type: 'scale',
        question: 'How predictable is your sales pipeline and revenue forecasting?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Highly predictable - consistent conversion rates and accurate forecasts',
            'Mostly predictable - good visibility with minor fluctuations',
            'Moderately predictable - reasonable forecasting with some uncertainty',
            'Somewhat unpredictable - significant variance in pipeline conversion',
            'Unpredictable - poor visibility into future revenue'
          ]
        },
        required: true
      },
      {
        id: 're-3.2',
        type: 'scale',
        question: 'How effective is your customer acquisition strategy?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Highly effective - strong ROI and sustainable acquisition costs',
            'Mostly effective - good acquisition with optimization opportunities',
            'Moderately effective - decent acquisition but room for improvement',
            'Somewhat ineffective - high acquisition costs or low conversion',
            'Ineffective - struggling to acquire customers profitably'
          ]
        },
        required: true
      },
      {
        id: 're-3.3',
        type: 'scale',
        question: 'How well do your sales and marketing teams collaborate?',
        scale: {
          min: 1,
          max: 5,
          labels: [
            'Excellent collaboration - seamless handoffs and shared metrics',
            'Good collaboration - mostly aligned with minor friction',
            'Adequate collaboration - working together but could improve',
            'Poor collaboration - frequent misalignment and friction',
            'No collaboration - teams working in silos'
          ]
        },
        required: true
      }
    ],
    industrySpecific: {
      regulated: {
        additionalQuestions: [
          {
            id: 're-reg-1',
            type: 'scale',
            question: 'How effectively do you manage regulatory compliance in sales processes?',
            scale: {
              min: 1,
              max: 5,
              labels: [
                'Excellent - all sales processes fully compliant',
                'Good - mostly compliant with minor issues',
                'Adequate - compliant but processes could be smoother',
                'Concerning - occasional compliance issues',
                'Poor - frequent compliance problems in sales'
              ]
            },
            required: true
          }
        ],
        requiredFields: ['compliance-officer-approval']
      },
      nonRegulated: {
        skipQuestions: []
      }
    },
    companyStageVariations: {
      startup: {
        focusAreas: ['product-market-fit', 'early-sales-process']
      },
      growth: {
        focusAreas: ['sales-scaling', 'market-expansion']
      },
      mature: {
        focusAreas: ['market-share-growth', 'customer-retention']
      }
    },
    scoringRules: {
      triggerThreshold: 4,
      criticalThreshold: 5,
      weightingFactors: {
        'pipeline-predictability': 1.5,
        'acquisition-effectiveness': 1.4,
        'sales-marketing-alignment': 1.2
      }
    }
  }
];

export const getDomainTemplate = (domainName: DomainName): DomainTemplate | undefined => {
  return assessmentDomains.find(domain => domain.domain === domainName);
};

export const getAllDomains = (): DomainName[] => {
  return assessmentDomains.map(domain => domain.domain);
};

export const getDomainQuestions = (
  domainName: DomainName,
  companyStage?: string,
  isRegulated?: boolean
): Question[] => {
  const domain = getDomainTemplate(domainName);
  if (!domain) return [];

  let questions = [...domain.questions];

  // Add industry-specific questions
  if (isRegulated && domain.industrySpecific.regulated.additionalQuestions) {
    questions = questions.concat(domain.industrySpecific.regulated.additionalQuestions);
  }

  // Add company stage-specific questions
  if (companyStage && domain.companyStageVariations[companyStage as keyof typeof domain.companyStageVariations]?.questions) {
    const stageQuestions = domain.companyStageVariations[companyStage as keyof typeof domain.companyStageVariations].questions;
    if (stageQuestions) {
      questions = questions.concat(stageQuestions);
    }
  }

  // Filter out skipped questions for non-regulated companies
  if (!isRegulated && domain.industrySpecific.nonRegulated.skipQuestions.length > 0) {
    questions = questions.filter(q => !domain.industrySpecific.nonRegulated.skipQuestions.includes(q.id));
  }

  return questions;
};
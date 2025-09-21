import { CompanySize } from './user';

export interface Company {
  id: string;
  name: string;
  industry: string;
  size: CompanySize;
  description?: string;
  website?: string;
  headquarters?: Address;
  contactInfo: ContactInfo;
  subscription: Subscription;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface ContactInfo {
  primaryContact: Contact;
  billingContact?: Contact;
  technicalContact?: Contact;
}

export interface Contact {
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

export interface Subscription {
  planId: string;
  status: SubscriptionStatus;
  billingPeriod: BillingPeriod;
  startDate: string;
  endDate?: string;
  features: string[];
  limits: SubscriptionLimits;
}

export type SubscriptionStatus =
  | 'active'
  | 'trial'
  | 'past_due'
  | 'canceled'
  | 'expired';

export type BillingPeriod = 'monthly' | 'annual';

export interface SubscriptionLimits {
  maxAssessments: number;
  maxAgents: number;
  maxUsers: number;
  maxStorageGB: number;
}
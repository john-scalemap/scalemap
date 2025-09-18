import { ApiResponse } from '@scalemap/shared/types/api';
import { Company } from '@scalemap/shared/types/company';

import apiClient from './client';
import { withRetry } from './retry';

export interface CompanyService {
  getCompany(companyId: string): Promise<ApiResponse<Company>>;
}

class CompanyServiceImpl implements CompanyService {
  async getCompany(companyId: string): Promise<ApiResponse<Company>> {
    return withRetry(() => apiClient.get<Company>(`/company/${companyId}`), {
      maxAttempts: 3,
      backoffMs: 1000,
    });
  }
}

export const companyService = new CompanyServiceImpl();
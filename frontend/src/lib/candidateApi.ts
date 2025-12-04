import apiClient from './axios';
import { AxiosResponse } from 'axios';

export interface ProfileFormData {
  name: string;
  email: string;
  location?: string;
  summary?: string;
  skills: string[];
  experience: {
    role: string;
    company: string;
    startDate: string;
    endDate?: string;
    description?: string;
  }[];
}

export const candidateApi = {
  getCandidate: async (userId: string): Promise<ProfileFormData> => {
    const response: AxiosResponse<ProfileFormData> = await apiClient.get(`/candidate/${userId}`);
    return response.data;
  },

  updateCandidateProfile: async (data: ProfileFormData): Promise<void> => {
    await apiClient.put('/candidate/profile', data);
  }
};
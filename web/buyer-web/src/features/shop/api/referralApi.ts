import { apiRequest } from '@/shared/api/http';

export type ReferralMeVm = {
  programEnabled: boolean;
  code: string;
  shareLink: string;
  shareMessage: string;
  referrerRewardAmount: number;
  refereeRewardAmount: number;
  hasAppliedCode: boolean;
  appliedCode: string | null;
};

export async function getReferralMe(token: string): Promise<ReferralMeVm> {
  const data = await apiRequest<ReferralMeVm>('/api/v1/referrals/me', { token });
  return {
    programEnabled: data?.programEnabled === true,
    code: data?.code ?? '',
    shareLink: data?.shareLink ?? '',
    shareMessage: data?.shareMessage ?? '',
    referrerRewardAmount: Number(data?.referrerRewardAmount) || 0,
    refereeRewardAmount: Number(data?.refereeRewardAmount) || 0,
    hasAppliedCode: data?.hasAppliedCode === true,
    appliedCode: data?.appliedCode ?? null,
  };
}

export async function applyReferralCode(token: string, code: string): Promise<ReferralMeVm> {
  await apiRequest<ReferralMeVm>('/api/v1/referrals/apply', {
    method: 'POST',
    token,
    body: { code: code.trim() },
  });
  return getReferralMe(token);
}

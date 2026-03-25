/**
 * Canton DevNet — единая точка конфигурации (серверная).
 * Дефолты ведут на нашу ноду DevNet (65.108.15.30:30757).
 * Использовать в API routes и серверном коде.
 * @see docs/PRD_CANTON_DEFI_2026/CANTON_DEVNET_FULL_INTEGRATION_PLAN.md
 * @see blockchain/DEFI_CONNECT_DEVNET.md
 */

const DEVNET_PARTICIPANT_URL = 'http://65.108.15.30:30757';
const DEVNET_PARTICIPANT_ID = 'participant1';
const DEVNET_PARTY_ID = 'wealth_management_party';

export const cantonDevnetDefaults = {
  participantUrl: DEVNET_PARTICIPANT_URL,
  participantId: DEVNET_PARTICIPANT_ID,
  partyId: DEVNET_PARTY_ID,
  authToken: '',
} as const;

export interface CantonParticipantConfig {
  participantUrl: string;
  participantId: string;
  partyId: string;
  authToken: string;
}

/**
 * Конфиг participant для серверного кода (API routes).
 * При отсутствии env — DevNet.
 */
export function getCantonParticipantConfig(): CantonParticipantConfig {
  if (typeof process === 'undefined' || !process.env) {
    return { ...cantonDevnetDefaults };
  }
  return {
    participantUrl: process.env.CANTON_PARTICIPANT_URL ?? DEVNET_PARTICIPANT_URL,
    participantId: process.env.CANTON_PARTICIPANT_ID ?? DEVNET_PARTICIPANT_ID,
    partyId: process.env.CANTON_PARTY_ID ?? DEVNET_PARTY_ID,
    authToken: process.env.CANTON_AUTH_TOKEN ?? '',
  };
}

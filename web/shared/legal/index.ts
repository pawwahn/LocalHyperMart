export type { LegalDocKey, PublicLegal } from './legalApi';
export {
  fetchPublicLegal,
  formatLegalStamp,
  legalBody,
  legalTitle,
  mapPublicLegal,
} from './legalApi';
export { LegalDocumentPage } from './LegalDocumentPage';
export { LegalLinks } from './LegalLinks';
export { TermsAcceptBlock } from './TermsAcceptBlock';
export { CookieNotice } from './CookieNotice';
export { OpenSourceNoticesPage } from './OpenSourceNoticesPage';
export { LegalAcceptGate } from './LegalAcceptGate';
export type { LegalUserProfile } from './legalUserApi';
export { fetchLegalUserProfile, needsLegalAcceptance, postAcceptLegal } from './legalUserApi';

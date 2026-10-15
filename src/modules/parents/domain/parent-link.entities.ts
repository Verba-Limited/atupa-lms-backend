export interface ParentLink {
  id: string;
  parentId: string;
  childId: string;
  createdAt?: Date;
}

/** Short-lived code a learner shares with a parent to approve linking. */
export interface LinkCode {
  id: string;
  learnerId: string;
  codeHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
}

export const LINK_CODE_TTL_MINUTES = 30;

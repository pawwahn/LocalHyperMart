export type DiagnosticsCatalogTestRow = {
  id?: string;
  code?: string | null;
  name: string;
  price: number;
  fastingNote?: string | null;
  prescriptionRequired?: boolean;
  homeCollection?: boolean;
  active?: boolean;
};

export type DiagnosticsCatalogPackageRow = {
  id?: string;
  code?: string | null;
  name: string;
  /** Shown to buyers as “what’s covered” (optional). */
  description?: string | null;
  price: number;
  active?: boolean;
  testIds: string[];
};

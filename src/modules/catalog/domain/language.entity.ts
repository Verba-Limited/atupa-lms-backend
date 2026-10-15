export interface Language {
  id: string;
  /** Stable lowercase identifier, e.g. "yoruba". New languages are data. */
  code: string;
  name: string;
  nativeName?: string;
  isActive: boolean;
  order: number;
}

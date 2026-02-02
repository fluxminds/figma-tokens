export interface DTCGShadowValue {
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
}

export type DTCGValue = string | number | string[] | DTCGShadowValue;

export interface DTCGToken {
  $value: DTCGValue;
  $type?: string;
  $description?: string;
}

export interface DTCGGroup {
  $type?: string;
  $description?: string;
  [key: string]: DTCGToken | DTCGGroup | string | undefined;
}

export interface DTCGRoot extends DTCGGroup {
  $name?: string;
}

export interface ParsedToken {
  path: string[];
  name: string;
  type: string;
  value: DTCGValue;
  category: TokenCategory;
}

export type TokenCategory = 'Colors' | 'Typography' | 'Spacing' | 'Border' | 'Effects' | 'Layout';

export interface ImportMessage {
  type: 'import';
  json: string;
}

export interface ProgressMessage {
  type: 'progress';
  current: number;
  total: number;
  stage: string;
}

export interface CompleteMessage {
  type: 'complete';
  summary: ImportSummary;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface ImportSummary {
  collections: number;
  variables: number;
  effectStyles: number;
  warnings: string[];
}

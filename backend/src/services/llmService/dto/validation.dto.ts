export type ValidationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  confidencePenalty: number;
}

export interface ValidationIssue {
  field: string;
  severity: ValidationSeverity;
  message: string;
  code: string;
}

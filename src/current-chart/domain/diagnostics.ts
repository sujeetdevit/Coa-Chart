/** Something an adapter skipped or corrected while normalising input. Never thrown; always reported. */
export interface AdapterDiagnostic {
  source: string;
  severity: 'warning' | 'error';
  message: string;
  /** Row index within the source, when applicable. */
  row?: number;
}

declare module 'pdf-parse' {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    pages: string[];
  }

  interface PdfParseOptions {
    max?: number;
    version?: string;
  }

  function pdf(buffer: Buffer, options?: PdfParseOptions): Promise<PdfData>;

  export = pdf;
}

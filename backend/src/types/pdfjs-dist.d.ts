declare module 'pdfjs-dist' {
  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPage>;
  }

  export interface PDFPage {
    getTextContent(): Promise<PDFTextContent>;
    getViewport(params: { scale: number }): PDFPageViewport;
  }

  export interface PDFTextContent {
    items: PDFTextItem[];
  }

  export interface PDFTextItem {
    str: string;
    transform: number[];
    width?: number;
    height?: number;
  }

  export interface PDFPageViewport {
    height: number;
    width: number;
  }

  interface GetDocumentParams {
    data: Buffer | Uint8Array;
    workerSrc?: string;
  }

  interface GetDocumentResult {
    promise: Promise<PDFDocumentProxy>;
  }

  export function getDocument(params: GetDocumentParams): GetDocumentResult;
  export const GlobalWorkerOptions: { workerSrc: string };
}

/**
 * pdfmake 0.2.x için asgari tip tanımı (paket kendi tiplerini içermiyor).
 * Yalnızca sunucu tarafı kullanımını (PdfPrinter + createPdfKitDocument) kapsar.
 */
declare module 'pdfmake' {
  interface PdfKitDocument extends NodeJS.ReadableStream {
    end(): void;
  }

  class PdfPrinter {
    constructor(fonts: Record<string, Record<string, string | Buffer>>);
    createPdfKitDocument(
      docDefinition: Record<string, unknown>,
      options?: Record<string, unknown>
    ): PdfKitDocument;
  }

  export = PdfPrinter;
}

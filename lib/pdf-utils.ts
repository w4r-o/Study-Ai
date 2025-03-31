/**
 * PDF processing utilities
 * 
 * Key Functions:
 * - extractTextFromPDF: Extracts text from PDF files
 * 
 * Integrations:
 * - pdf2json
 * 
 * Used By:
 * - lib/actions.ts
 * 
 * Dependencies:
 * - pdf2json
 */

import PDFParser from 'pdf2json';

/**
 * Extracts text from a PDF file
 * @param file PDF file to extract text from
 * @returns Extracted text
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log("Starting PDF extraction for:", file.name);
    console.log("File size:", file.size, "bytes");

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a new parser instance
    const pdfParser = new PDFParser();

    // Parse PDF content
    const text = await new Promise<string>((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        try {
          // Convert PDF data to text
          const rawText = pdfData.Pages.map(page => 
            page.Texts.map(text => 
              decodeURIComponent(text.R.map(r => r.T).join(' '))
            ).join(' ')
          ).join('\n\n');

          resolve(rawText);
        } catch (error) {
          reject(error);
        }
      });

      pdfParser.on('pdfParser_dataError', (error) => {
        reject(error);
      });

      // Load PDF data
      pdfParser.parseBuffer(buffer);
    });

    // Clean up the extracted text
    const cleanedText = text
      // Remove multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove multiple spaces
      .replace(/[ \t]+/g, ' ')
      // Clean up common PDF artifacts
      .replace(/[^\S\r\n]+$/gm, '')
      // Fix common encoding issues
      .replace(/\\u[\dA-F]{4}/gi, match => 
        String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
      )
      .trim();

    console.log("PDF extraction complete:");
    console.log("- Text length:", cleanedText.length, "characters");

    return cleanedText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


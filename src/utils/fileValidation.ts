// Filename validation for Supabase storage uploads
// Storage keys can only contain: letters, numbers, dots, underscores, and hyphens

const INVALID_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

export interface FilenameValidation {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Validates a filename for Supabase storage compatibility
 * @param filename - The filename to validate (e.g., "my video.mp4")
 * @returns Validation result with error message and suggested filename if invalid
 */
export function validateFilename(filename: string): FilenameValidation {
  const invalidChars = filename.match(INVALID_FILENAME_CHARS);
  
  if (invalidChars) {
    // Get unique invalid characters for error message
    const uniqueInvalidChars = [...new Set(invalidChars)];
    const displayChars = uniqueInvalidChars.map(char => 
      char === ' ' ? 'space' : `"${char}"`
    ).join(', ');
    
    // Create a clean suggested filename
    const suggestion = filename.replace(INVALID_FILENAME_CHARS, '_');
    
    return {
      isValid: false,
      error: `Filename contains invalid characters: ${displayChars}`,
      suggestion: suggestion,
    };
  }
  
  return { isValid: true };
}

/**
 * Sanitizes a filename by replacing invalid characters with underscores
 * @param filename - The filename to sanitize
 * @returns Sanitized filename safe for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(INVALID_FILENAME_CHARS, '_');
}

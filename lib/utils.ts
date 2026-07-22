import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips all HTML tags from the given text, leaving only the text content.
 *
 * Example: stripHtml('<p>Hello <b>world</b></p>') → 'Hello world'
 *
 * Used to sanitize resume text and job descriptions before passing them to
 * the AI service (Requirement 3.9).
 */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

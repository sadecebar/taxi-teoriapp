// English translations for all quiz questions
// Format: { [questionId]: { question, options, explanation } }
// correct, id, delprov, image remain unchanged from source files.

import { DP1_EN }  from "./questions-en-dp1.js";
import { DP2A_EN } from "./questions-en-dp2a.js";
import { DP2B_EN } from "./questions-en-dp2b.js";

export const QUESTIONS_EN = {
  ...DP2A_EN,  // Lagstiftning 1-3 (IDs 1–150)
  ...DP2B_EN,  // Lagstiftning 4-6 (IDs 151–300)
  ...DP1_EN,   // Säkerhet 1-3 + Navigering (IDs 301–460)
};

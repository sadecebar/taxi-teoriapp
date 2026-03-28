import { LAGSTIFTNING_1 } from "./lagstiftning-1.js";
import { LAGSTIFTNING_2 } from "./lagstiftning-2.js";
import { LAGSTIFTNING_3 } from "./lagstiftning-3.js";
import { LAGSTIFTNING_4 } from "./lagstiftning-4.js";
import { LAGSTIFTNING_5 } from "./lagstiftning-5.js";
import { LAGSTIFTNING_6 } from "./lagstiftning-6.js";

import { SAKERHET_1 } from "./sakerhet-1.js";
import { SAKERHET_2 } from "./sakerhet-2.js";
import { SAKERHET_3 } from "./sakerhet-3.js";
import { NAVIGERING_1 } from "./navigering-1.js";

export const DELPROV_1_QUESTIONS = [
  ...SAKERHET_1,
  ...SAKERHET_2,
  ...SAKERHET_3,
  ...NAVIGERING_1,
];

export const DELPROV_2_QUESTIONS = [
  ...LAGSTIFTNING_1,
  ...LAGSTIFTNING_2,
  ...LAGSTIFTNING_3,
  ...LAGSTIFTNING_4,
  ...LAGSTIFTNING_5,
  ...LAGSTIFTNING_6,
];

export const QUESTIONS = [
  ...DELPROV_1_QUESTIONS,
  ...DELPROV_2_QUESTIONS,
];
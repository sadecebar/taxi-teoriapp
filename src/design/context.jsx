import { createContext, useContext } from 'react';
export const StudyContext = createContext(null);
export function useStudy() { return useContext(StudyContext); }

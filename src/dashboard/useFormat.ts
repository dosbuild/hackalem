import {useCallback} from 'react';
import {useContent} from '../modes/content';
import type {Decision} from '../domain/types';
export function useDecisionLabel(){const {mode,scopeName}=useContent();return useCallback((decision:Decision)=>`${mode.projects[decision.initiativeId].name} · ${scopeName(decision)}`,[mode,scopeName]);}

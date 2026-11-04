import { t } from '../../../i18n/index.js';
import { createFacingLab, facingLab } from '../facing-lab.js?v=20260821-evolution-3';
import { createPawnEvolutionLab, pawnEvolutionLab } from '../pawn-evolution-lab.js?v=20260821-evolution-3';
import { createDeploymentBudgetLab, deploymentBudgetLab } from '../deployment-budget-lab.js?v=20260821-budget-lab-1';
import {
  createCaptureKingVictoryLab,
  createEscortKingVictoryLab,
  createSurvivalVictoryLab,
  captureKingVictoryLab,
  escortKingVictoryLab,
  survivalVictoryLab
} from '../victory-labs.js?v=20260822-victory-labs-1';

export const MECHANIC_LABS = Object.freeze([
  Object.freeze({
    id: facingLab.id,
    name: 'Orientación de piezas', nameKey: 'lab.facing.name',
    description: 'Prueba frontal/espalda y cambios de encaramiento.', descriptionKey: 'lab.facing.description',
    createLevel: createFacingLab
  }),
  Object.freeze({
    id: pawnEvolutionLab.id,
    name: 'Evolución del peón', nameKey: 'lab.pawn.name',
    description: 'Prueba movimiento bidireccional y captura en cuatro diagonales del Peón+.', descriptionKey: 'lab.pawn.description',
    createLevel: createPawnEvolutionLab
  }),
  Object.freeze({
    id: deploymentBudgetLab.id,
    name: 'Presupuesto de despliegue', nameKey: 'lab.deployment.name',
    description: 'Compara las seis piezas base y evolucionadas con un presupuesto de 50 puntos.', descriptionKey: 'lab.deployment.description',
    createLevel: createDeploymentBudgetLab
  }),
  Object.freeze({
    id: captureKingVictoryLab.id,
    name: 'Victoria · Capturar rey', nameKey: 'level.lab_victory_capture',
    description: captureKingVictoryLab.description, descriptionKey: 'lab.victory_capture.description',
    createLevel: createCaptureKingVictoryLab
  }),
  Object.freeze({
    id: escortKingVictoryLab.id,
    name: 'Victoria · Cruzar con rey', nameKey: 'level.lab_victory_escort',
    description: escortKingVictoryLab.description, descriptionKey: 'lab.victory_escort.description',
    createLevel: createEscortKingVictoryLab
  }),
  Object.freeze({
    id: survivalVictoryLab.id,
    name: 'Victoria · Sobrevivir', nameKey: 'level.lab_victory_survive',
    description: survivalVictoryLab.description, descriptionKey: 'lab.victory_survive.description',
    createLevel: createSurvivalVictoryLab
  })
]);

export function listMechanicLabs() {
  return MECHANIC_LABS.map(({ id, name, description, nameKey, descriptionKey }) => ({ id, name: nameKey ? t(nameKey) : name, description: descriptionKey ? t(descriptionKey) : description }));
}

export function getMechanicLabFactory(levelId) {
  return MECHANIC_LABS.find(lab => lab.id === levelId)?.createLevel ?? null;
}

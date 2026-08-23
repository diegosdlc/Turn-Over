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
    name: 'Orientación de piezas',
    description: 'Prueba frontal/espalda y cambios de encaramiento.',
    createLevel: createFacingLab
  }),
  Object.freeze({
    id: pawnEvolutionLab.id,
    name: 'Evolución del peón',
    description: 'Prueba movimiento bidireccional y captura en cuatro diagonales del Peón+.',
    createLevel: createPawnEvolutionLab
  }),
  Object.freeze({
    id: deploymentBudgetLab.id,
    name: 'Presupuesto de despliegue',
    description: 'Compara las seis piezas base y evolucionadas con un presupuesto de 50 puntos.',
    createLevel: createDeploymentBudgetLab
  }),
  Object.freeze({
    id: captureKingVictoryLab.id,
    name: 'Victoria · Capturar rey',
    description: captureKingVictoryLab.description,
    createLevel: createCaptureKingVictoryLab
  }),
  Object.freeze({
    id: escortKingVictoryLab.id,
    name: 'Victoria · Cruzar con rey',
    description: escortKingVictoryLab.description,
    createLevel: createEscortKingVictoryLab
  }),
  Object.freeze({
    id: survivalVictoryLab.id,
    name: 'Victoria · Sobrevivir',
    description: survivalVictoryLab.description,
    createLevel: createSurvivalVictoryLab
  })
]);

export function listMechanicLabs() {
  return MECHANIC_LABS.map(({ id, name, description }) => ({ id, name, description }));
}

export function getMechanicLabFactory(levelId) {
  return MECHANIC_LABS.find(lab => lab.id === levelId)?.createLevel ?? null;
}

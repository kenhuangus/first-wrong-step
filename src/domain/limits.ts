import type { LimitCode } from "../contracts/domain";
import { ComplexityError } from "./errors";
export const LIMITS = Object.freeze({
  maxSteps: 12,
  maxLineCharacters: 256,
  maxTotalCharacters: 3072,
  maxTokensPerEquation: 128,
  maxNumericDigits: 12,
  maxParenthesisDepth: 8,
  maxNodesPerEquation: 96,
  maxTotalNodes: 768,
  maxWallMilliseconds: 500,
  maxWorkUnits: 20_000,
});
export type Clock = () => number;
export class AnalysisBudget {
  private readonly startedAt: number;
  private workUnits = 0;
  private totalNodes = 0;
  public constructor(private readonly clock: Clock = () => performance.now()) {
    this.startedAt = clock();
  }
  public charge(units = 1): void {
    this.workUnits += units;
    if (this.workUnits > LIMITS.maxWorkUnits)
      throw new ComplexityError("work_units");
    this.checkTime();
  }
  public addNode(lineNodes: number): void {
    if (lineNodes > LIMITS.maxNodesPerEquation)
      throw new ComplexityError("line_nodes");
    this.totalNodes += 1;
    if (this.totalNodes > LIMITS.maxTotalNodes)
      throw new ComplexityError("total_nodes");
    this.charge();
  }
  public checkTime(): void {
    if (this.clock() - this.startedAt > LIMITS.maxWallMilliseconds)
      throw new ComplexityError("wall_time");
  }
  public force(limit: LimitCode): never {
    throw new ComplexityError(limit);
  }
}
export function preflightInput(
  problem: string,
  steps: readonly string[],
): void {
  if (steps.length > LIMITS.maxSteps) throw new ComplexityError("step_count");
  if (
    [problem, ...steps].reduce((sum, line) => sum + line.length, 0) >
    LIMITS.maxTotalCharacters
  )
    throw new ComplexityError("total_characters");
}

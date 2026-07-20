import type { InputErrorCode, LimitCode } from "../contracts/domain";
export class InputError extends Error {
  public constructor(
    public readonly code: InputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InputError";
  }
}
export class ComplexityError extends Error {
  public constructor(public readonly limit: LimitCode) {
    super("Input too complex—shorten this equation or solution");
    this.name = "ComplexityError";
  }
}

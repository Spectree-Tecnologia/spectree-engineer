import { Result } from './result.js';

export interface UseCase<IN, OUT> {
  execute(data: IN): Promise<Result<OUT>>;
}

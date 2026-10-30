import { CreateRepository } from './create.repository.js';
import { DeleteRepository } from './delete.repository.js';
import { Entity } from '../base/index.js';
import { FindByIdRepository } from './find-by-id.repository.js';
import { UpdateRepository } from './update.repository.js';

export interface CrudRepository<T extends Entity<any, any>>
  extends CreateRepository<T>, UpdateRepository<T>, FindByIdRepository<T>, DeleteRepository {}

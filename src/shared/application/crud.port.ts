/** Generic persistence operations shared by most repository ports. */
export interface CrudPort<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  findByIds(ids: string[]): Promise<T[]>;
  create(input: Omit<T, 'id'> | Partial<T>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  /** claims issued by the identity module; empty until the product has roles (architecture rule 14) */
  roles: string[];
}

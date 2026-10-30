export type JwtPayload = {
  sub: string;
  name: string;
  email: string;
  roles?: string[];
  iat?: number;
  exp?: number;
};

# DTO Pattern

## DTO types

- Input DTO:
  - input of a command/use case/filters.
  - examples: `FindAllUsersInDTO`, `ProductFiltersDTO`.
- Output DTO:
  - output of a use case/controller.
  - examples: `FindAllUsersOutDTO`, `ProductListDTO`.
- Query DTO (CQRS):
  - read projection for the API/front end.
  - examples: `UserDTO`, `RoleDTO`, `ProductDetailsDTO`.

## Query DTO modeling rule

- Do not extend an entity class.
- Valid options:
  - Derive from `*Props` with adaptation (`Omit`, `Pick`, enriched fields) when needed.
  - Create a dedicated, independent DTO when the projection requires it.

Real examples:

- `modules/auth/src/user/dto/user.dto.ts`
  - `UserDTO extends Omit<UserProps, "roleIds">` + `roles` and `permissions`.
- `modules/auth/src/role/dto/role.dto.ts`
  - `RoleDTO extends Omit<RoleProps, "permissionIds">` + `permissions`.
- `modules/product/src/product/dto/product-details.dto.ts`
  - `ProductDetailsDTO extends Omit<ProductProps, "subcategoryId" | "brandId">` + `category/subcategory/brand`.

## Useful conventions observed

- Input/output with clear suffixes:
  - `FindAllXxxInDTO`
  - `FindAllXxxOutDTO`
  - `FindAllXxxMetaDTO`
- Separate list items:
  - `ProductListItem`, `BranchListItem`.
- Dedicated filters:
  - `ProductFiltersDTO`, `BrandFiltersDTO`.

## Boundaries

- A DTO carries no domain rule.
- A DTO must not depend on Prisma/ORM.
- A read DTO may be enriched for the front end (e.g. `formattedPrice`), as long as the transformation lives in the query/use case.

## Checklist

- [ ] DTO type identified (input/output/query).
- [ ] Names follow the intent convention.
- [ ] Typing suited to the final consumer.
- [ ] No coupling to the concrete entity or ORM.
- [ ] In CQRS, the query returns a read DTO and not an entity when the projection is the contract.

## Common pitfalls

- Using an entity as the API payload without need.
- Mixing command fields with read fields in the same DTO.
- Coupling the DTO to the database structure.
- Not separating pagination metadata from the data.

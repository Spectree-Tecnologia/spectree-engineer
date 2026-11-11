# 02: Rename a category and refuse duplicates

**What to build:** A user renames a category; a second category with the same name and kind is refused.

**Blocked by:** 01

**Status:** ready-for-agent

Module: categories · Aggregate: category

- [ ] `PATCH /categories/:id` renames a category of the caller.
- [ ] A duplicate name of the same kind, in any letter case, fails with `CATEGORY_NAME_ALREADY_EXISTS`, on create and on rename.
- [ ] Another user's category is `CATEGORY_NOT_FOUND`.

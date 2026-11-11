# 03: Archive a category

**What to build:** A user archives a category; it leaves the list and stays on what already used it.

**Blocked by:** 01

**Status:** ready-for-agent

Module: categories · Aggregate: category

- [ ] `DELETE /categories/:id` archives the category (soft delete).
- [ ] An archived category is not listed and cannot be renamed.
- [ ] Archiving twice is `CATEGORY_NOT_FOUND`.

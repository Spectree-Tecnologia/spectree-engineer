# 01: Create a category

**What to build:** A user creates a category of income or of expense and sees it in their list.

**Blocked by:** None (can start immediately)

**Status:** done (merged into feat/categories at 4c1d9ae)

Module: categories · Aggregate: category

- [x] `POST /categories` creates a category with a name and a kind (skill: `config-new-module`, `module-aggregate`).
- [x] The name is required, up to 40 characters; the kind is `income` or `expense`.
- [x] `GET /categories` lists the caller's own categories only.

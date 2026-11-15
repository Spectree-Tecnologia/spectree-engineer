---
type: regex
# the only graph table is the recommended one (the mission's guard-rail): the `accounts` row must not have `transactions` in the 4th cell ("Downstream of"), which would be the accounts <-> transactions cycle
pattern: '^\|\s*`?accounts`?\s*\|(?:[^|\n]*\|){2}[^|\n]*transactions'
flags: mi
match: not_contains
---

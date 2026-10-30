---
type: regex
# a única tabela de grafo é a recomendada (guard-rail da missão): a linha de `accounts` não pode ter `transactions` na 4ª célula ("Downstream of"), que seria o ciclo accounts <-> transactions
pattern: '^\|\s*`?accounts`?\s*\|(?:[^|\n]*\|){2}[^|\n]*transactions'
flags: mi
match: not_contains
---

# Categories

## Problem Statement

A user records income and expenses but cannot say what each one was for. Without a category, the month is a list of amounts.

## Solution

Each user keeps their own list of categories, each one of income or of expense, and picks one when recording a transaction.

## User Stories

1. As a user, I want to create a category with a name and a kind (income or expense), so that I can tag transactions with it.
2. As a user, I want to rename a category, so that a typo does not stay forever.
3. As a user, I want to archive a category I no longer use, so that it stops showing in the picker while old transactions keep it.
4. As a user, I want to see only my own categories, so that nobody else's list leaks into mine.
5. As a user, I want a duplicate name of the same kind to be refused, so that the picker never shows two equal entries.

## Implementation Decisions

- A new module `categories` with one aggregate, `category`.
- `kind` is a value object with two values: `income`, `expense`.
- Archiving is a soft delete (`deletedAt`), as in architecture rule 12.
- Routes: `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`, `GET /categories`.

## Testing Decisions

- Use cases are tested at `execute()` with an in-memory repository; the e2e covers the guard and the query budget of the list.

## Out of Scope

- Sub-categories, colours and icons.
- Tagging transactions: that is the `transactions` item.

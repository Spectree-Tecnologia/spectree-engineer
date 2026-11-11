// Aggregate root: Account. Layout: dto/ model/ provider/ use-case/
export * from './dto'       // AccountDTO
export * from './model'     // Account (entity), AccountName, AccountType ('checking'|'savings'|'wallet'), Money
export * from './provider'  // AccountRepository { findAccount, existsByName, create, update }, AccountQuery { findByUserId, findById }
export * from './use-case'  // CreateAccount, UpdateAccount, DeactivateAccount — all execute() -> Result<void|string>

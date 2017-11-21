### Overview ###

Sails extension for RDBMS transactions based on Domains API. 
Currently supported Sails v.^1, MySQL, and PostgreSQL.

### Usage ###

Module exposed as sails.services.transaction

    sails.services.transaction.startTransaction(callback) - creates context and starts transction
    sails.services.transaction.commitTransaction(callback) - commites transaction
    sails.services.transaction.rollbackTransaction(callback) - rollbacks transaction
	sails.services.transaction.getTransactionContext() - gets transaction context with transaction ID. Store any session data here
	
### Hint ###
Start transaction can be placed to http middleware so each user request will be computed in separate connection in single transaction.

### Details ###

All promises and async code invoked in startTransaction callback will have the same context with its own transaction ID. All queries and ORM methods from Waterline models will go thru the same connection according to transaction ID from context.
The module uses its own pool. Default pool size is 300, this value can be changed by sailsTransactionsPoolSize property in adapter config.

### Warning ###

Domain support for native promises implemented in node 8. May work unstable with the deffered module. 
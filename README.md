### Overview ###

Sails extension for RDBMS transactions based on Domains API. 
Currently supports Sails v.^1, MySQL, and PostgreSQL.

Existing Sails adapters don’t support transactions for the whole request or async code chain. Current implementation forces you to keep transaction or connection object. This module provides simple API to wrap any part of application code into transaction without significant changes.

### Usage ###

Module exposed as sails.services.transaction

    sails.services.transaction.startTransaction(callback) - creates context and starts transction
    sails.services.transaction.commitTransaction(callback) - commites transaction
    sails.services.transaction.rollbackTransaction(callback) - rollbacks transaction
	sails.services.transaction.getTransactionContext() - gets transaction context with transaction ID. Store any session data here
	
### Hint ###
Start transaction can be placed to http middleware so each user request will be computed in separate connection in single transaction.

### Details ###

All promises and async code invoked in startTransaction callback will have the same context with their own transaction ID. 
All queries and ORM methods from Waterline models will go through the same connection according to transaction ID from the context. 
The module uses its own pool. The default pool size is 300, this value can be changed by sailsTransactionsPoolSize property in the adapter config.


### Warning ###

Domain support for native promises is implemented in node 8. May work unstable with the deferred module.
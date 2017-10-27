var poolModule = require('./lib/pool');
var transactionService = require('./lib/transaction');
var _ = require('lodash');
var adapterMethodsToWrap = ['create', 'createEach', 'find', 'update', 'destroy', 'join', 'avg', 'sum', 'count'];
var supportedAdapters = [];

function wrapAdapterMethods(adapter, pool) {
    adapterMethodsToWrap.forEach(method => {
        if (_.isFunction(adapter[method])) {
            var old = adapter[method];
            adapter[method] = function (datastoreName, query, cb) {
                if (!query.meta) {
                    query.meta = {};
                }
                if (!query.meta.leasedConnection) {
                    var trn_id = sails.services.transaction.getTransactionId();
                    var onGetConnection = (err, conn) => {
                        if (conn) {
                            query.meta.leasedConnection = conn;
                        }
                        old.apply(adapter, arguments);
                    };
                    if (trn_id === null) {
                        pool.getGeneralConnection(onGetConnection);
                    } else {
                        pool.getConnection(trn_id, onGetConnection);
                    }
                } else {
                    old.apply(adapter, arguments);
                }
            }
        }
    });
}

function getDataStoreConf(adapter) {
    var datastore = adapter.datastores.default || _.values(adapter.datastores)[0];
    if (!datastore) {
        return null;
    }
    return _.cloneDeep(datastore.config);
}

module.exports = function sailsTransactions(sails) {

    sails.on('ready', () => {
        var adapterSelected = false;
        _.forOwn(sails.adapters, (adapter, name) => {
            if (adapterSelected) {
                return;
            }
            if (name === 'sails-postgresql' && adapter.adapterApiVersion >= 1) {
                var supported = 'pg';
            } else if (name === 'sails-mysql' && adapter.adapterApiVersion >= 1) {
                supported = 'mysql';
            }

            if (supported){
                var conf = getDataStoreConf(adapter);
                if (conf) {
                    supportedAdapters.push(name);
                    conf[supported] = true;

                    var pool = poolModule(conf);
                    sails.services.transaction = transactionService(pool);
                    wrapAdapterMethods(adapter, pool);
                    adapterSelected = name;
                } else {
                    sails.log.error(`sails-transactions hook failed to load. Cannot locate DB connection config for adapter ${name}.`);
                }
            }
        });
        if (!adapterSelected) {
            sails.log.warn(`sails-transactions: cant find appropriate adapter. 
                Supported adapters are sails-postgresql ^1, sails-mysql ^1`);
        } else {
            sails.log.info(`sails-transaction service working on ${adapterSelected} adapter.`);
        }
    });
    return {};
};
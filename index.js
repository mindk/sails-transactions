var pool = require('./lib/pool');
var transactionService = require('./lib/transaction');
var _ = require('lodash');
var adapterMethodsToWrap = ['create', 'createEach', 'find', 'update', 'destroy', 'join', 'avg', 'sum', 'count'];
var supportedAdapters = [];

function wrapAdapterMethods(adapter) {
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
        _.forOwn(sails.adapters, (adapter, name) => {
            if (name === 'sails-postgresql' && adapter.adapterApiVersion >= 1) {
                supportedAdapters.push(name);
                var conf = getDataStoreConf(adapter);
                if (conf) {
                    conf.pg = true;
                    if (conf.url) {
                        conf.connectionString = conf.url;
                    }
                    pool = pool(conf);
                    sails.services.transaction = transactionService(pool);
                    wrapAdapterMethods(adapter);
                } else {
                    sails.log.error(`sails-transactions hook failed to load. Cannot locate DB connection config for adapter ${name}.`);
                }
            } else {
                sails.log.warn(`sails-transactions: unsupported adapter ${name} ${adapter.adapterApiVersion}. 
                Supported adapters is sails-postgresql ^1`);
            }
        });
    });
    return {};
};
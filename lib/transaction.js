var domain = require('domain');
var trnCount = 0;

function getNextTrnId() {
    if (trnCount >= Number.MAX_SAFE_INTEGER) {
        trnCount = 0;
    }
    return ++trnCount;
}

module.exports = function (pool) {
    return {
        commitTransaction: function (done) {
            var trn_id = this.getTransactionId();
            if (!trn_id) {
                return done({message: 'There is no active transaction'});
            }
            pool.getConnection(trn_id, (err, conn) => {
                if (err) {
                    return done(err);
                }
                conn.query('commit', err => {
                    conn.releaseConnection();
                    done(err);
                });
            });
        },

        rollbackTransaction: function (done) {
            var trn_id = this.getTransactionId();
            if (!trn_id) {
                return done({message: 'There is no active transaction'});
            }
            pool.getConnection(trn_id, (err, conn) => {
                if (err) {
                    return done(err);
                }
                conn.query('rollback', err => {
                    conn.releaseConnection();
                    done(err);
                });
            });
        },

        startTransaction: function (done) {
            var curDomain = domain.create();
            curDomain.run(() => {
                var trn_id = getNextTrnId();
                domain.active.trnctx = {
                    trn_id: trn_id
                };
                pool.getConnection(trn_id, (err, conn) => {
                    if (err) {
                        return done(err);
                    }
                    conn.query('start transaction', done);
                });
            });
        },

        getTransactionId: function () {
            try {
                return domain.active.trnctx.trn_id;
            } catch (e) {
                return null;
            }
        },

        getTransactionContext: function () {
            try {
                return domain.active.trnctx || null;
            } catch (e) {
                return null;
            }
        }
    };
};


var _ = require('lodash'),
    mysql = require('mysql'),
    pg = require('pg');

var spawnPgConn = function (config, done) {
    if (config.url) {
        config.connectionString = config.url;
    }
    var pgPool = pg.Pool(config);
    pgPool.connect(function (err, client, close) {
        if (err) {
            return done(err);
        }
        client.close = function () {
            close();
            pgPool.end();
        };
        client.connection.on('error', function (e) {
            if (this.onError) {
                this.onError(e);
            }
        });
        done(null, client);
    });
};

var spawnMysqlConn = function (config, done) {
    if (config.url) {
        config = config.url;
    }
    var client = mysql.createConnection(config);
    client.connect(function (err) {
        if (err) {
            console.error(err);
            return done(err);
        }
        client.close = function () {
            this.destroy();
        };
        client.on('error', function (e) {
            if (client.onError) {
                client.onError(e);
            }
        });
        done(null, client);
    });
};

var spawnConn = function (config, done) {
    if (config.pg) {
        return spawnPgConn(config, done);
    }
    if (config.mysql) {
        return spawnMysqlConn(config, done);
    }
    done({message: 'Unrecognized target DB'});
};
module.exports = function (config) {
    var usedConnections = {},
        availableConnections = [],
        maxConnections = config.sailsTransactionsPoolSize || 300,
        internalConn = null;

    var spawnInternalConn = function (done) {
        spawnConn(config, (err, conn) => {
            if (err) {
                console.error(`Error connecting to DB with config:\n${JSON.stringify(config)}`);
                console.error(err);
                internalConn = null;
            } else {
                internalConn = conn;
                conn.onError = function (err) {
                    console.error(err);
                    try {
                        internalConn.close();
                    } catch (e) {
                    }
                    internalConn = null;
                }
            }
            if (done) {
                done(err);
            }
        });
    };

    var addToPool = function (client) {
        if ((availableConnections.length + _.keys(usedConnections).length) > maxConnections) {
            client.closeConnection();
        } else {
            availableConnections.push(client);
        }
    };

    var getConnection = function (trn_id, cb) {
        if (!usedConnections[trn_id]) {
            if (availableConnections.length) {
                var client = availableConnections.pop();
                client.trn_id = trn_id;
                usedConnections[trn_id] = client;
                cb(null, client);
            } else {
                spawnConn(config, function (err, client) {
                    if (err) {
                        return cb(err);
                    }
                    client.onError = err => {
                        console.error('Connection error ' + err);
                    };

                    client.releaseConnection = function () {
                        delete usedConnections[this.trn_id];
                        this.trn_id = undefined;
                        addToPool(this);
                    };

                    if (usedConnections[trn_id]) {
                        client.releaseConnection();
                        return cb(null, usedConnections[trn_id]);
                    }

                    client.trn_id = trn_id;
                    usedConnections[trn_id] = client;
                    cb(null, client);
                });
            }
        } else {
            cb(null, usedConnections[trn_id]);
        }
    };

    return {
        getConnection: getConnection,
        getGeneralConnection: function (done) {
            if (!internalConn) {
                spawnInternalConn(err => {
                    done(err, internalConn);
                });
            } else {
                done(null, internalConn);
            }
        }
    };
};
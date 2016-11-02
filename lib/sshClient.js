'use strict';

//create a ssh connection to a server

const SocketIO = require('socket.io');
const LogStream = require('./logStream');
const Configs = require('../config');
const Cache = require('./cache');

// execute promise tasks in sequential
const PromiseAll = (promiseTasks) => {
  let result = {resolved: {}, rejected: {}};

  return new Promise((resolve) => {
    let status = Promise.resolve();

    promiseTasks.forEach((promiseTask, index) => {
      status = status.then(promiseTask)
      .then((data) => {
        result.resolved[index] = data;
      })
      .catch((err) => {
        result.rejected[index] = err.message;
      });
    });
    status.then(() => resolve(result));
  });
};

module.exports = {
  conn: function(combo) {
    const logFolder = Configs.logRootFolder;
    const servers = Configs.servers;
    const port = Configs.portIndex || 9527;

    const _makeSocket = (host, i) => new Promise((resolve, reject) => {
      const logStream = new LogStream();
      const io = SocketIO();

      // listen to connection from client
      io.sockets.on('connection', (client) => {
        console.log('======== socket :: connected :: ' + client.id);
        if (logStream.conn) { // connected already
          logStream.join(client);
        } else {  // not connected yet
          logStream.create(host, combo, logFolder + Configs.logs[0], client)
          .then(() => {
            resolve();
          })
          .catch((err) => { reject(err); });
        }

        // listen to change-log event from client
        client.on('change-log', data => {
          // client.emit('sync-logname', {log: data.log}); // notify all clients
          Cache.log = data.log;  // update cache
          logStream.connect(logFolder + data.log)
          .then(() => {})
          .catch((err) => {
            console.log('======== socket :: change-log :: err', err);
          });
        });

        // listen to set-date event from client
        client.on('set-date', data => {
          logStream.connect(logFolder + Cache.log + '.' + data.date, data.filter)
          .then(() => {})
          .catch((err) => {
            console.log('======== socket :: change-log :: err', err);
          });
        });

        // listen to reset-date event from client
        client.on('reset-date', () => {
          logStream.connect(logFolder + Cache.log)
          .then(() => {})
          .catch((err) => {
            console.log('======== socket :: change-log :: err', err);
          });
        });

        // listen to leave event from client
        client.on('leave', () => {
          console.log('======== socket :: close connection :: ' + client.id);
          logStream.leave(client.id);
        });
      });

      // start socket
      io.listen(port + i);
    });

    let createSockets = [];
    for (let i = 0; i < servers.length; i++) {
      let socket = _makeSocket(servers[i], i);
      createSockets.push(socket);
    }

    return PromiseAll(createSockets)
    .then((result) => {
      const errKeys = Object.keys(result.rejected); // check error
      if (errKeys.length > 0) {
        return Promise.reject(result.rejected[errKeys[0]]);
      } else {
        return Promise.resolve(true);
      }
    });
  },
};

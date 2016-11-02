'use strict';

const Koa = require('koa');
const Router = require('koa-router')();
const Views = require('co-views');
const Serve = require('koa-static');
const BodyParser = require('koa-bodyparser');
const Configs = require('./config');
const Cache = require('./lib/cache');
const SshClient = require('./lib/sshClient');

const App = Koa();
App.use(BodyParser());

// render function
const render = Views(__dirname + '/views', { map: { html: 'swig' }});

// routers
Router.get('/', function *() {
  let data = {
    domain: Configs.domain,
    socketServers: Configs.servers,
    socketPort: Configs.portIndex,
    socketReady: false,
    log: Cache.log,
  };
  if (Cache.ready) {
    data.socketReady = true;
  }

  this.body = yield render('index.html', data);
}).post('/start', function *() {
  let data = { success: false, error: 'ssh login failed' };

  try {
    let combo = JSON.parse(this.request.body.combo);
    if (combo.name && combo.password) {
      data.success = yield SshClient.conn(combo); // start ssh connection
      if (data.success) {
        Cache.ready = true;
        Cache.log = Configs.logs[0];
      } else {
        Cache.ready = false;
      }
    } else {
      data.error = 'username and password required!';
    }
  } catch (e) {
    data.error = e.message;
  }

  this.body = data;
});

App.use(Router.routes())
  .use(Router.allowedMethods())
  .use(errorHandler());

// static resource serving
App.use(Serve(__dirname + '/views'));

App.on('error', function(err, ctx) {
  console.error('server error:', err.message, ctx);
});

function errorHandler() {
  return function* (next) {
    try {
      yield next;
    } catch (err) {
      this.status = 500;
      this.body = 'Server Internal Error: ' + err.message;
      // can emit on app for log
      // this.app.emit('error', err, this);
    }
  };
}

App.listen(5001);

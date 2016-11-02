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

// 定义渲染方法
const render = Views(__dirname + '/views', { map: { html: 'swig' }});

// 定义路由
Router.get('/', function *() {
  // 检查socket.io服务端是否启动，渲染页面
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
  let data = { success: false, error: 'ssh登录失败' };

  try {
    let combo = JSON.parse(this.request.body.combo);
    if (combo.name && combo.password) {
      // 启动socket.io服务端
      data.success = yield SshClient.conn(combo);
      if (data.success) {
        Cache.ready = true;
        Cache.log = Configs.logs[0];
      } else {
        Cache.ready = false;
      }
    } else {
      data.error = '必须输入用户名和密码';
    }
  } catch (e) {
    data.error = e.message;
  }

  this.body = data;
});

App.use(Router.routes())
  .use(Router.allowedMethods())
  .use(errorHandler());

// 伺服静态文件
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
      this.body = '服务器内部错误: ' + err.message;
      // can emit on app for log
      // this.app.emit('error', err, this);
    }
  };
}

App.listen(5001);

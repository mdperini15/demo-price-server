'use strict';

function init(server) {
  server.route({
    method: 'GET',
    path: '/{filename}',
    handler: {
      file: function (request) {
        return request.params.filename;
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    handler: {
      file: function (request) {
        return 'index.html';
      }
    }
  });
}

module.exports = {
  init: init
};
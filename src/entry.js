// A file URL cannot access account sessions or the database. Open the application server.
if (location.protocol === 'file:') location.replace('http://localhost:3000/' + (location.hash || '#/login'));

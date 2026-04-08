'use strict';
 
const { getUserByToken } = require('./db');
 
function requireAuth(req, res, next) {
    const header = req.headers['authorization'] || '';
    const match  = header.match(/^Bearer\s+(.+)$/i);
 
    if (!match) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }
 
    const user = getUserByToken(match[1].trim());
    if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
    }
 
    req.user = user;
    next();
}
 
module.exports = { requireAuth };
 
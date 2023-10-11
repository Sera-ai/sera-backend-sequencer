require('dotenv').config();
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const mongoString = process.env.DATABASE_URL;
const bodyParser = require('body-parser');
const { dynamicRouteHandler } = require('./routes/routes.app');

mongoose.connect(mongoString, { dbName: "Sera" });
const database = mongoose.connection;

database.on('error', (error) => { console.log(error) })
database.once('connected', () => { console.log('Database Connected'); })

const app = express();

const middlewareChecker = (req, res, next) => {
    app.use('/', dynamicRouteHandler)
    next();
};

const http = require('http');
const server = http.createServer(app);

app.use(cors(), express.json(), bodyParser.urlencoded({ extended: true }), bodyParser.json(), middlewareChecker);
server.listen(10081, () => {
    console.log(`Sequencer Started at ${10081}`)
})
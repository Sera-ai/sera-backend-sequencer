const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const mongoString = process.env.DB_HOST;
const bodyParser = require('body-parser');
const { masterSequencer } = require('./src/routes/routes.app');
const { sequencer } = require('./src/routes/routes.sequence');

mongoose.connect(mongoString, { dbName: "Sera" });
const database = mongoose.connection;

database.on('error', (error) => { console.log(error) })
database.once('connected', () => { console.log('Database Connected'); })

const app = express();

const middlewareChecker = (req, res, next) => {
    app.use('/', sequencer)
    next();
};

const http = require('http');
const server = http.createServer(app);

app.use(cors(), express.json(), bodyParser.urlencoded({ extended: true }), bodyParser.json(), middlewareChecker);
server.listen(process.env.BE_SEQUENCER_PORT, () => {
    console.log(`Sequencer Started at ${process.env.BE_SEQUENCER_PORT}`)
})
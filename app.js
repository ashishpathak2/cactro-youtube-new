require('dotenv').config({ path: './config.env' });

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const session = require('express-session');
const db = require('./src/config/dbConn');
const authRouter = require('./routes/auth').router;
const youtubeRouter = require('./routes/youtube');

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');



app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, sameSite: 'lax' },
}));

app.use('/auth', authRouter);
app.use('/youtube', youtubeRouter);

app.get('/', (req, res) => {
  res.render('index', {
    isAuthenticated: !!req.session.tokens,
    videoDetails: null,
    comments: [],
    notes: [],
    videoId: null,
    error: req.query.error || null,
  });
});

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  res.render('error', {
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {},
    status: err.status || 500,
  });
});



module.exports = app;
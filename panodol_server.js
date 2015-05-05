#!/usr/bin/env node --harmony
'use strict';
const
  express = require('express'),
  exphbs  = require('express-handlebars'),
  bodyParser = require('body-parser'),
  morgan = require('morgan'),
  session = require('express-session'),
  //RedisStore = require('connect-redis')(session),
  fs = require('fs'),
  path = require('path'),
  app = express();


app.use(morgan('dev'));

// REGISTER Handlebars as template engine
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// BEGIN AUTHENTICATION
var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

app.use(session({ 
  secret: '5492fc184305f70f8e8849afa8e1c40c'
}));
app.use(passport.initialize());
app.use(passport.session());

var User = function(username) {
  this.username = username;
}

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    if(username == "Pano" && password == "Panodol1234") {
      var user = new User(username);
      console.log("authenticated");
      return done(null, user);
    }
    else {
      return done(null, false, { message: 'Incorrect username or password.' });
    }
  })
);

// Custom middleware to authenticate custom routes
function authed(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/login.html');
  }
}

app.get('/login',
  passport.authenticate('local', { successRedirect: '/',
                                   failureRedirect: '/login.html'
                                 })
);
// END AUTHENTICATION

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/login.html');
});

app.use(express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/static_html'));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

var roumors = ["romor 1", "roumor2"];

app.post('/roumors', authed, function(req, res) {
  var roumor = req.body.roumor;
  roumors.push(roumor);
  //res.status(200).json({'todo': todo});
  console.log('New Roumor saved: ' + JSON.stringify(roumor));
  res.redirect('/roumors');
});


app.get('/roumors', authed, function(req, res){
    res.render("roumors", { title: 'Grüchtli-Wand', roumors: roumors });
});

app.get('/userlist', authed, function(req, res){
    res.render('userlist', { title: 'TN-Liste' });
});

app.get('/', authed, function(req, res) {
  res.render("home");
});

// Spawn Server
app.listen(80, function(){
  console.log("ready captain.");
});


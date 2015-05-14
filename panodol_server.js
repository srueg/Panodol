#!/usr/bin/env node --harmony
'use strict';
const
  express = require('express'),
  exphbs  = require('express-handlebars'),
  bodyParser = require('body-parser'),
  morgan = require('morgan'),
  session = require('express-session'),
  RedisStore = require('connect-redis')(session),
  fs = require('fs'),
  path = require('path'),
  cradle = require('cradle'),
  moment = require('moment'),
  app = express();

var c = new(cradle.Connection)('http://localhost', 5984, {
      cache: false,
      raw: false,
      forceSave: true
  });

// create roumors DB
var roumorsDb = c.database('roumors');
//roumorsDb.destroy();
roumorsDb.exists(function (err, exists) {
  if (err) {
    console.log('error', err);
  } else if (exists) {
    console.log('Database found.');
  } else {
    console.log('Database does not exists, create now.');
    roumorsDb.create();
  }
});

// create sleep DB
var sleepDb = c.database('sleep');
//sleepDb.destroy();
sleepDb.exists(function (err, exists) {
  if (err) {
    console.log('error', err);
  } else if (exists) {
    console.log('Database found.');
  } else {
    console.log('Database does not exists, create now.');
    sleepDb.create();
  }
});

app.use(morgan('dev'));

// REGISTER Handlebars as template engine
app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// BEGIN AUTHENTICATION
var passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy;

app.use(session({
  secret: '5492fc184305f70f8e8849afa8e1c40c',
  store: new RedisStore()
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
    var user = process.env.PANODOL_USER || 'Pano';
    var pw = process.env.PANODOL_PW || 'Panodol1234';
    if(username === user && password === pw) {
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

// Logout function
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/login.html');
});

app.use(express.static(__dirname + '/bower_components'));
app.use(express.static(__dirname + '/static_html'));
app.use('/images', authed);
app.use('/images', express.static(__dirname + '/images'));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// Save new roumor
app.post('/roumors', authed, function(req, res) {
  var roumor = {text: req.body.roumor, time: moment().format("DD.MM.YYYY, HH:mm:ss")};
  roumorsDb.save(roumor, function (err, result) {
    if(err) console.log('error', err);
    res.redirect('/roumors');
    console.log('New Roumor saved: ' + JSON.stringify(roumor));
  });
});

// Show all roumors
app.get('/roumors', authed, function(req, res){
  roumorsDb.all(function (err, docs) {
    if(err) console.log('error', err);
    var roumors = [];
    var i = 0;
    if(docs.length == 0) res.render("roumors", { title: 'Grüchtli-Wand', roumors: roumors });
    docs.forEach(function(element, index){
      roumorsDb.get(element, function (err2, doc) {
        if(err2) console.log('error', err2);
        roumors.push(doc)
        if(i == docs.length-1){
          roumors.sort(function(a, b){
            return new Date(b.time) - new Date(a.time);
          });
          res.render("roumors", { title: 'Grüchtli-Wand', roumors: roumors });
        }
        i++;
      });
    });
  });
});

// Save new sleep
app.post('/sleepInput', authed, function(req, res) {
  var sleep = {name: req.body.pfadiname, 
              sleep: req.body.sleep,
              dream: req.body.dream,
              environment: req.body.environment,
              sleepLength: req.body.sleep_length,
              sleptWith: req.body.slept_with,
              night: req.body.night };
  var sleptWith = req.body.slept_with;
  if (sleptWith != '') {
    var text = req.body.pfadiname + ' war mit ' + sleptWith + ' im Schlafsack.';
    var roumor = {
      text: text, 
      time: moment().format("DD.MM.YYYY, HH:mm:ss")
    };
    roumorsDb.save(roumor, function (err, result) {
      if(err) console.log('error', err);
      console.log('New Roumor saved: ' + JSON.stringify(roumor));
    });

  }
  sleepDb.save(sleep, function (err, result) {
    if(err) console.log('error', err);
    res.redirect('/sleepOverview');
    console.log('New sleep saved: ' + JSON.stringify(sleep));
  });
});

// Show TN-List
app.get('/userlist', authed, function(req, res){
    res.render('userlist', { title: 'TN-Liste' });
});

// Show sleep input
app.get('/sleepInput', authed, function(req, res){
    res.render('sleepInput', { title: 'Schlaf', night: req.query.night });
});

// Show sleep input
app.get('/sleepOverview', authed, function(req, res){
    res.render('sleepOverview', { title: 'Schlaf Übersicht' });
});

// Show sleep charts
app.get('/sleepAnalysis', authed, function(req, res){
  var id = req.query.night;

  var sleep = { labels: [],
                  datasets: [ {
                      label: "Schlaf",
                      fillColor: "rgba(220,220,220,0.5)",
                      strokeColor: "rgba(220,220,220,0.8)",
                      highlightFill: "rgba(220,220,220,0.75)",
                      highlightStroke: "rgba(220,220,220,1)",
                      data: []
                  } ] 
                };
  var dream = { labels: [],
                  datasets: [ {
                      label: "Traum",
                      fillColor: "rgba(220,220,220,0.5)",
                      strokeColor: "rgba(220,220,220,0.8)",
                      highlightFill: "rgba(220,220,220,0.75)",
                      highlightStroke: "rgba(220,220,220,1)",
                      data: []
                  } ] 
                };
  var environment = { labels: [],
                  datasets: [ {
                      label: "Umgebung",
                      fillColor: "rgba(220,220,220,0.5)",
                      strokeColor: "rgba(220,220,220,0.8)",
                      highlightFill: "rgba(220,220,220,0.75)",
                      highlightStroke: "rgba(220,220,220,1)",
                      data: []
                  } ] 
                };
  var length = { labels: [],
                  datasets: [ {
                      label: "Länge",
                      fillColor: "rgba(220,220,220,0.5)",
                      strokeColor: "rgba(220,220,220,0.8)",
                      highlightFill: "rgba(220,220,220,0.75)",
                      highlightStroke: "rgba(220,220,220,1)",
                      data: []
                  } ] 
                };
  
  sleepDb.all(function (err, docs) {
      if(err) console.log('error', err);
      var i = 0;
      if(docs.length == 0) res.render('sleepAnalysis', { data: { title: 'Schlaf-Analyse', sleepData: {} } } );
      docs.forEach(function(element, index){
        sleepDb.get(element, function (err2, doc) {
          if(err2) console.log('error', err2);
          if(doc.night === id){
            sleep.labels.push(doc.name);
            dream.labels.push(doc.name);
            environment.labels.push(doc.name);
            length.labels.push(doc.name);

            sleep.datasets[0].data.push(doc.sleep);
            dream.datasets[0].data.push(doc.dream);
            environment.datasets[0].data.push(doc.environment);
            length.datasets[0].data.push(doc.sleepLength);
          }
          if(i == docs.length-1){
            var s = JSON.stringify(sleep);
            var d = JSON.stringify(dream);
            var e = JSON.stringify(environment);
            var l = JSON.stringify(length);
            res.render('sleepAnalysis', { data: { title: 'Schlaf-Analyse', sleepData: s, dreamData: d, environmentData: e, lengthData: l } } );
          }
          i++;
        });
      });
    });
});

// Show Home
app.get('/', authed, function(req, res) {
  res.render("home");
});

// Spawn Server
var server = app.listen(80, function() {
  console.log("ready captain.");
});

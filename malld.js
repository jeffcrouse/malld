var express = require('express');
var http = require('http');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var util = require('util');
var request = require('request');
var fs = require('fs');
var glob = require("glob")

var recordings_dir = util.format('%s/recordings', __dirname);
fs.exists(recordings_dir, function(exists) {
	if (!exists) fs.mkdir(recordings_dir);
});


var twilio_conf = {
	'sid': 'ACcc854bb5309b0308c6f6af4aa3ececf3',
	'auth_token': 'ced5bbb0b7f9f5ffe416abe9ff6b4f0b'
}

var twilio = require('twilio');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(require('less-middleware')({ src: path.join(__dirname, 'public') }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

app.get('/', function(req, res){
  res.render('index', { title: 'Express' });
});


app.get('/announcement', function(req, res){
	var local = util.format('%s/recordings/*.mp3', __dirname);
	glob(local, function (err, files) {
		if(err) res.send(err);
		else if(files.length==0) res.send("None available.");
		else {
			var n = Math.floor(Math.random() * files.length);
			res.download(files[n]);
		}
	})
});

app.get('/incoming', function(req, res){
	// if (!twilio.validateExpressRequest(req, twilio_conf.auth_token)) {
	// 	res.send('you are not twilio.  Buzz off.');
	// 	return;
	// }

	var twiml = new twilio.TwimlResponse();
	var greeting_mp3 = util.format('http://%s/greetings/greeting001.mp3', req.headers.host);
	console.log(greeting_mp3);

	twiml.play(greeting_mp3);
	twiml.pause({ length: 2 });

	twiml.say('Please wait for the beep and then begin your recording. Press the pound key when you are finished.', {
		voice:'woman',
	    language:'en'
	});
	twiml.pause({ length: 2 });
	twiml.record({"finishOnKey": "#", 
		"action": "/recording", 
		"method": "get", 
		"maxLength": 1200, 
		"playBeep": true
	});

    res.type('text/xml');
    res.send(twiml.toString());
});

app.get("/recording", function(req, res){

	// if (!twilio.validateExpressRequest(req,  twilio_conf.auth_token)) {
	// 	res.send('you are not twilio.  Buzz off.');
	// 	return;
	// }

	var error = function(err) {
		var twiml = new twilio.TwimlResponse();
		var message = "Sorry, there has been an error. "+err+" Please hang up and try again.";
		twiml.say(message, {
			voice:'woman',
		    language:'en'
		});
		twiml.hangup();
		res.type('text/xml');
    	res.send(twiml.toString());
	}

	if(!req.query.RecordingUrl) {
		error("No recording found.");
		return;
	}

	var url = req.query.RecordingUrl+".mp3";
	var id = req.query.RecordingSid;
	var local = util.format('%s/recordings/%s.mp3', __dirname, id);
	console.log("Downloading "+url+" to "+local)
	var f = fs.createWriteStream(local);
	var r = request(url).pipe(f);

	r.on('data', function(data) {
		console.log('binary data received');
	});

	f.on('end', function () {

		var twiml = new twilio.TwimlResponse();
		twiml.say('Thank you very much for your contribution! You may now hang up.', {
			voice:'woman',
		    language:'en'
		});

		twiml.pause({ length: 1 });
		twiml.hangup();
		res.type('text/xml');
	    res.send(twiml.toString());
	});

	f.on('error', function (err) {
		console.log(err);
		error('download error');
	});
});


app.get('/instructions', function(req, res){
    res.render('instructions', {});
})

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;

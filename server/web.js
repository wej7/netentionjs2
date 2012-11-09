var sensor = { };
var clients = { };
var objects = { };
var objectInterest = { };


var util = require('../client/util.js');
var config = require('../config.js');
var cortexit = require('./cortexit.js');

var http = require('http')
  , url = require('url')
  , fs = require('fs')
  , sys = require('util')
  , socketio= require('socket.io')
  , nodestatic = require('node-static')
  , server;
  

var file = new(nodestatic.Server)('./client');

var logMemory = util.createRingBuffer(256); 

var databaseUrl = process.env['MongoURL']; //"mydb"; // "username:password@example.com/mydb"
var collections = [ "obj" ];


var db = require("mongojs").connect(databaseUrl, collections);
if (db == undefined)
	nlog('MongoDB connection failed');
else
	nlog('MongoDB connected');

//http://howtonode.org/node-js-and-mongodb-getting-started-with-mongojs
/*db.obj.save({ id: 'AnonymousAgentExample',  type: [ 'agent'], email: "anonymous@server.com", name: 'Anonymous'}, function(err, saved) {
	  if( err || !saved ) console.log("User not saved: " + err);
	  else console.log("User saved");
});*/
/*db.obj.find({ }, function(err, objs) {
	  if( err || !objs) console.log("No object found");
	  else objs.forEach( function(x) {
	    console.log(x);
	  } );
});*/


function nlog(x) {
	
	var xs = x;
	if (typeof(x)!="string")
		xs = JSON.stringify(x,null,4);
	
	var msg = new Date() + ': ' + xs;
	
	console.log(x);
	logMemory.push(msg);
}

http.globalAgent.maxSockets = 256;

function sendJSON(res, x) {
	res.writeHead(200, {'content-type': 'text/json' });
	res.end( JSON.stringify(x,null,4) );
}

var httpServer = http.createServer(function(req, res){
  
	if (req.url == '/log') {
		console.dir(logMemory.buffer);
		sendJSON(res, logMemory.buffer);
	}
	else {
		req.addListener('end', function () {
		   file.serve(req, res);
		});
	}
});

httpServer.listen(config.port);

nlog('Web server on port ' + config.port);

var io = socketio.listen(httpServer);

io.enable('browser client minification');  // send minified client
io.enable('browser client etag');          // apply etag caching logic based on version number
io.enable('browser client gzip');          // gzip the file
io.set('log level', 1);                    // reduce logging
io.set('transports', [                     // enable all transports (optional if you want flashsocket)
    'websocket'
//  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
]);


function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}

var channelListeners = {};

function pub(channel, message) {
	nlog(channel + ":" + JSON.stringify(message));
	io.sockets.in(channel).emit('receive-' + channel, message);
}

io.sockets.on('connection', function(socket) {
	
	//https://github.com/LearnBoost/socket.io/wiki/Rooms
	socket.on('subscribe', function(channel) { 
		nlog('subscribed: ' + channel);
		socket.join(channel); 
	});
	socket.on('unsubscribe', function(channel) { 
		nlog('unsubscribed: ' + channel);
		socket.leave(channel); 
	});
	

    socket.on('pub', function(channel, message) {
	pub(channel, message);
        //socket.broadcast.emit('receiveMessage', message);
    });
    
    socket.on('getSensors', function(withSensors) {
        withSensors(sensor);
    });
    
    socket.on('getSensor', function(id, withSensor) {
        if (sensor[id]!=undefined) {
            withSensor(sensor[id]);
        }
        else {
            console.error('Unknown sensor: ' + id);
        }
    });
    
    socket.on('connectSelf', function(cid) {
       if (cid == null) {
           cid = uuid();
           socket.emit('setClientID', cid);
       } 
       nlog('connect: ' + cid);
       socket.set('clientID', cid);

       for (c in clients) {
           if (c == cid) continue;
           var s = clients[c];           
           socket.emit('setClient', c, s);
       }
    });
    
    socket.on('updateSelf', function(s) {
        socket.get('clientID', function (err, c) {
            if (c == null) {
                socket.emit('reconnect');
            }
            else {
                nlog('update: ' + c + ': ' + s.name + ' , ' + s.geolocation);
                clients[c] = s;
                socket.broadcast.emit('setClient', c, s);
                
                updateInterests(c, s);
            }
        });
    });
    
    socket.on('getSentencized', function(urlOrText, withResult) {
    	cortexit.getSentencized(urlOrText, withResult);
    });
    socket.on('getClientInterests', function(f) {
    	f(interestTime);
    });
    
});


function addSensor(path) {
    var s = require('./../client/sensor/' + path + '.js');
    var se = s.sensor;
    
    if ((s === undefined) || (se === undefined)) {
        console.error('Sensor: ' + path + ' not found');
        return;
    }
    
    se.clientJS = '/sensor/' + path + '.client.js';
    
    sensor[se.id()] = se;

    se.refresh(sensor, function() { 
        console.log('Added sensor: ' + se.id());
    }, function() { 
        console.error('Error adding sensor: ' + se.id());
    });

    
};

var interestTime = { };
var clientState = { };

function updateInterests(clientID, state) {
	state.when = Date.now();
	
	var prevState = clientState[clientID];
	clientState[clientID] = state;
	
	
	if (prevState!=undefined) {
		for (k in state.interests) {
			var v = state.interests[k];
			var pv = prevState.interests[k];
			if (pv==undefined) {
				pv = 0;
			}
			else {
				var averageInterest = (v + pv)/2.0;
				if (interestTime[k] == undefined)
					interestTime[k] = 0;
				interestTime[k] += (state.when - prevState.when)/1000.0 * averageInterest;
			}
		}
		for (k in prevState.interests) {
			var v = state.interests[k];
			var pv = prevState.interests[k];
			if (v==undefined) {
				v = 0;				
				var averageInterest = (v + pv)/2.0;				
				if (interestTime[k] == undefined)
					interestTime[k] = 0;
				interestTime[k] += (state.when - prevState.when)/1000.0 * averageInterest;
			}
			
		}
	} 
	
}

// process.on('uncaughtException', function (err) {
   // console.error('An uncaught error occurred!');
   // console.error(err.stack);
// });

addSensor('geology/USGSEarthquake');
addSensor('pollution/IAEANuclear');
addSensor('geology/MODISFires');

var stockquotes = require('./sensor/stockquotes.js');

var b = util.OutputBuffer(2500, function(o) { 
	pub('chat', o);	
});
b.start();

/*
var g = stockquotes.GoogleStockBot(['aapl','msft','ibm', 'goog'], b);
g.start();*/


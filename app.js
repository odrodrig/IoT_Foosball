/*eslint-env node*/

//------------------------------------------------------------------------------
// Foosbuzz v.3
//
// Authors: Oliver Rodriguez, Stefania Kaczmarczyk
// License: The MIT License
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
//1. Requiring Modules and Necessary Setup                          ---------------
//------------------------------------------------------------------------------

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var client = require("ibmiotf");
var cfenv = require('cfenv');
var passport = require('passport');
var Strategy = require('passport-twitter').Strategy;
var fs = require('fs');
var Twitter = require('twitter');

var GameFile = require("./objects/gameFile");
var User = require("./objects/user");
var game = require("./util/game");
var login = require("./routes/login");
var db = require("./util/database");

// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));
app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true }));


//------------------------------------------------------------------------------
//2. Customize These Variables                                      ---------------
//------------------------------------------------------------------------------

var org = "";					//This is the orgID from the Watson IoT Platform
var id = "";				//This can be whatever you choose to name your application
var auth_key = "";		//This is the API Key generated in the Watson IoT Platform dashboard
var auth_token = "";  //This is the API Auth Token generated in the Watson IoT Platform dashboard

var twitterKey = "";  //This is the API Key from Twitter when you register an app
var twitterSecret = "";  //This is the API secret token from Twitter when you register an app
var twitterAccessKey = "" //Access token key from Twitter
var twitterAccessSecret = "" //Access token secret from Twitter

var location = "";  //Where will the foosball table be located? This is just for record keeping purposes with the leaderboard

var debugging = false; //When set to true, app will not send out tweets. Set to true if you are just testing app or debugging
//------------------------------------------------------------------------------
//3. Declaration of necessary variables                             ---------------
//------------------------------------------------------------------------------


// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

//Instantiating Game File
var gf = new GameFile;

//Instantiating both players
var player1 = new User;
var player2 = new User;

player1.location = location;
player2.location = location;

var team = "";
var league = [];

var oldPlayer1 = {};
var oldPlayer2 = {};

//------------------------------------------------------------------------------
//4. Watson IoT setup and message handling                          ---------------
//------------------------------------------------------------------------------

//Starting the server
server.listen(appEnv.port, function () {
	console.log('Server starting on port ' + appEnv.port);
});

//Gathering credentials for the Watson IoT Platform
var appClientConfig = {
	"org" : org,
	"id" : id,
	"domain": "internetofthings.ibmcloud.com",
	"auth-key" : auth_key,
	"auth-token" : auth_token,
	"enforce-ws" : true
}

//Creating an application client to receive device messages from Watson IoT
var appClient = new client.IotfApplication(appClientConfig);
appClient.connect();


//Handles when the application connects to the platform
appClient.on("connect", function() {
	console.log("IoT client connected!");

	//Subscribe to all events from the table
	appClient.subscribeToDeviceEvents();
})

//Handle events from the table
appClient.on("deviceEvent", function (deviceType, deviceId, eventType, format, payload) {

	//Handle reset button
	if(payload == 0) {

		console.log("reset");
		io.emit('reset', {reset: true});
		game.resetGame(gf);
		logOutUsers();

		//Handle goal for team 1
	} else if(payload == 1) {

		if(isValid(gf)) {

			console.log("goal team 1");
			game.goal(gf, player1, player2, 1);
			io.emit('goal', {team: 1, game: gf});

			if (gf.goalsTeam1 >= 5) {
				io.emit("gameWon", {team: 1, game:gf});
				player1.wins++;
				player2.losses++;
				oldPlayer1=player1;
				oldPlayer2=player2;

				if(!debugging) {
					twitterClient.post('statuses/update', {status: '@'+player1.handle+" has won the game. Better luck next time @"+player2.handle+"."}, function(error, tweet, response) {
					  if (!error) {
					    console.log(tweet);
					  }
					});
				}
				endGame(gf);
			}

		} else {
			console.log("Error recording score");
		}

		//Handle goal for team 2
	} else if(payload == 2) {

		if(isValid(gf)) {

			console.log("goal team 2");
			game.goal(gf, player2, player1, 2);
			io.emit('goal', {team: 2, game: gf});

			if (gf.goalsTeam2 >= 5) {
				io.emit("gameWon", {team: 2, game:gf});
				player2.wins++;
				player1.losses++;
				oldPlayer1=player1;
				oldPlayer2=player2;

        if(!debugging) {
  				twitterClient.post('statuses/update', {status: '@'+player2.handle+" has won the game. Better luck next time @"+player1.handle+"."}, function(error, tweet, response) {
  				  if (!error) {
  				    console.log(tweet);
  				  }
  				});
        }
				endGame(gf);
			}

		} else {
			console.log("Error recording score");
		}

	}

});

//Outputs error events
appClient.on("error", function(error) {
	console.log("Error: " + error);
})

//------------------------------------------------------------------------------
//5. Twitter authentication handling                                ---------------
//------------------------------------------------------------------------------

var twitterClient = new Twitter({
  consumer_key: twitterKey,
  consumer_secret: twitterSecret,
  access_token_key: twitterAccessKey,
  access_token_secret: twitterAccessSecret
});

//Configues the authentication with Twitter
passport.use(new Strategy({
    consumerKey: twitterKey,
    consumerSecret: twitterSecret,
    callbackURL: appEnv.url+"/login/twitter/return"
  },
  function(token, tokenSecret, player, cb) {

	//Grab the Twitter photo and strip out the minimizer
    var photo = player.photos[0].value;
    photo = photo.replace("_normal", "");

  	//Grab the necessary info from a successful Twitter log in
		//Note: The only data taken from Twitter is the given display name, Twitter handle, and profile photo
  	var twitterData = {
			id:player.id,
			handle:player.username,
			name:player.displayName,
			photo:photo,
			chosenTeam:team
		};

		//Send Twitter data off to be processed
		twitterLogin(twitterData);

    return cb(null, player);
}));

// Configure Passport authenticated session persistence.
passport.serializeUser(function(user, cb) {
  cb(null, user);
});
passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

//------------------------------------------------------------------------------
//6. Endpoints                                                      ---------------
//------------------------------------------------------------------------------

//Handles requests to end game. This will be called if a user ends the game prematurely with the "End Game" button
app.get("/end", function(req, res) {

	if(isValid(gf)) {

		endGame(gf);
		logOutUsers();

		res.send(true);

	} else {

		console.log("Error ending game.");
		res.send({error: "Error ending game"});

	}

})

//Handles requests to start the game
app.get("/start", function(req, res) {

	if (isValid(gf)) {

		game.startGame(gf);
		res.send(true);

	} else {
		console.log("Error starting game.");
		res.send({error: "Error starting game."});
	}

})

//Handles requests for a rematch. This will be called if the user clicks on the "Rematch" button.
//This ends the game and starts a new game but keeps the same users logged in.
app.get("/rematch", function(req, res) {

	game.resetGame(gf);

	player1 = oldPlayer1;
	player2 = oldPlayer2;

	gf.userTeam1 = player1.name;
	gf.userTeam2 = player2.name;

	game.loggedIn.player1 = true;
	game.loggedIn.player2 = true;

	io.emit("reset");

	res.send(gf);

});



//Sends gameFile to the front-end. This is called everytime the page is refreshed or a new client connects to the page.
app.get("/currentGame", function(req, res) {

		res.send({
			game: gf,
			players: {
				 player1: player1,
			 	 player2: player2
			}
		});
});

//Handles login requests for the Team 1 log in button
app.get('/login1', function(req, res) {
	team = 1;
	res.redirect('/login/twitter');
});

//Handles login requests for the Team 2 log in button
app.get('/login2',function(req, res) {
	team = 2;
	res.redirect('/login/twitter');
});

//Redirects from the log in buttons. This sends the user to Twitter to authenticate with their account.
app.get('/login/twitter',passport.authenticate('twitter', { forceLogin: true }));

//Callback for successful Twitter authentication
app.get('/login/twitter/return',
  passport.authenticate('twitter', { failureRedirect: '/', successRedirect: '/' }),
  function(req, res) {
  req.logout();
  //res.redirect('/');
});

//Handles requests to list the league of players. This is called on page load and everytime the league table refreshes.
app.get('/league', function(req, res) {
	var player = {};

	//First see if the players database exists
	db.isCreated(function(created) {

		//If it does exist then...
		if(created) {

			//Get the list of players
			db.getLeague(function(players) {

				//After getting the array of players, then structure into a format that the front-end can understand
				for(var x=0;x<players.length;x++) {
					player.photo= '<img id="playerpic" src="'+players[x].doc.photo+'"/>';
					player.username= players[x].doc.name;
					player.handle= "@"+players[x].doc.handle;
					player.games= players[x].doc.totalGames;
					player.won= players[x].doc.wins;
					player.lost= players[x].doc.losses;
					player.goalSpread= players[x].doc.goalsFor + ":" + players[x].doc.goalsAgainst;
					player.goalDiff= players[x].doc.goalsFor-players[x].doc.goalsAgainst;
					player.points= (players[x].doc.wins*3)+(players[x].doc.losses*(-2));
					league[x] = player;
					player = {};
				}
				res.send({"data": league});
			});

		//If the database doesn't exist, send an empty league.
		} else {
			res.send({"data": ""});
		}
	});
});


//------------------------------------------------------------------------------
//7. Function Declarations                                          ---------------
//------------------------------------------------------------------------------

//Handles log in data from Twitter and creates player objects with the Twitter data
function twitterLogin(data) {

	if(isValid(gf)) {

		var loginId = data.id;
		var loginName = data.name;
		var loginTeam = data.chosenTeam;
		var loginHandle = data.handle;
		var loginPhoto = data.photo;

		if (loginTeam == 1) {

			player1.id = loginId;
			player1.name = loginName;
			player1.handle = loginHandle;
			player1.photo = loginPhoto;

			gf.userTeam1 = loginName;
			gf.IDTeam1 = loginHandle;
			game.loggedIn.player1 = true;
			io.emit("login", {player: player1, team: 1});
			db.storeUser(player1, function() {
				console.log("Player 1 Stored");
			});

		}

		if (loginTeam == 2) {

			player2.id = loginId;
			player2.name = loginName;
			player2.handle = loginHandle;
			player2.photo = loginPhoto;

			gf.userTeam2 = loginName;
			gf.IDTeam2 = loginHandle;

			game.loggedIn.player2 = true;
			io.emit("login", {player: player2, team: 2});
			db.storeUser(player2, function() {
				console.log("Player 2 stored");
			});

		}

		if((game.loggedIn.player1 == true || game.loggedIn.player2 == true) && gf.gameActive == true) {

      if(!debugging) {
  			twitterClient.post('statuses/update', {status: 'A game has started between @'+player1.handle+" and @"+player2.handle}, function(error, tweet, response) {

  			  if (!error) {
  			    console.log(tweet);
  			  }
  			});
      }
		}

	}

};

//Check whether the gamefile is valid
function isValid(gf) {

	if (gf.gameActive == true && game.isOld(gf) == false) {

		return true;

	//If the game is not active, log all users off and start a new game
	} else if (gf.gameActive == false) {


		logOutUsers();
		game.startGame(gf);
		io.emit("gameStart");
		return true;

	//If the game is old, log off users and reset the game
	} else if (game.isOld(gf)) {

		logOutUsers();
		game.resetGame(gf);
		io.emit("gameStart");
		return true;
	}
	return false;
}

//Function handles the various steps needed to end game and store the results in the database
function endGame(gameFile) {
	game.endGame(gameFile, function() {
		db.storeUser(player1, function() {
			db.storeUser(player2, function() {
				db.storeGame(gameFile, function() {
					game.clearGameFile(gameFile);
				});
			});
		});
	});
}

//Function handles logging users out
function logOutUsers() {
	player1 = new User();
	player2 = new User();

	player1.location = location;
	player2.location = location;

	io.emit("reset");

}

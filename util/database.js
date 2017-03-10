//database.js
//Author: Oliver Rodriguez
//
//These functions are used to interact with the database

//Cloudant Setup
var Cloudant = require('cloudant');
var cloudant = Cloudant({vcapServices: JSON.parse(process.env.VCAP_SERVICES)});

//Initial database setup
cloudant.db.list(function(err, databases){

  //If the players datatbase does not exist, create the database. This should only trigger on a new deployment of the app.
  if(databases.indexOf('players') == -1) {
    cloudant.db.create('players', function(err, body) {
      if(err) {
        console.log(err);
      } else {

        console.log("Players database created successfully");

        //Create the design doc and view needed to retrieve players from the database
        cloudant.db.use('players').insert({
          "views": {
            "getPlayers": {
              "map": function (doc) {emit("twitterID", doc.id);}
            }
          }
        }, "_design/Players", function(err) {
          if(err) {
            console.log(err);
          }
        });

      }

    });
  }

  //If the games database does not exist, create the database. This should only trigger on a new deployment of the app.
  if(databases.indexOf('games') == -1) {
    cloudant.db.create('games', function(err) {
      if(err) {
        console.log(err);
      } else {
        console.log("Games database created successfully");
      }
    });
  }

});

//Assign variables to the databases
var players = cloudant.use('players');
var games = cloudant.use('games');

//Variable declaration
var exists = false;
var playerFile = "";
var league = "";
var lastIndex = "";

//database object constructor
function database () {

  this.storeGame= storeGame;
  this.storeUser= storeUser;
  this.getLastGameID= getLastGameID;
  this.getLeague= getLeague;
  this.isCreated= isCreated;

}

//Handles sending the gameFile to the database
function storeGame (gameFile, callback) {

  getLastGameID(function(Id) {
    gameFile.gameID = Id+1;

    games.insert(gameFile, function(err) {

      if(err) {
        console.log(err);
      } else {
        console.log("Game Saved");
      }
    });
  });
  callback();
}

//Store the user in the database
function storeUser(user, callback) {

  //Only store the user if they have logged in.
  if(user.name != "Player 1" && user.name != "Player 2" && user.name != "") {

    //First check if they exist in the players databae
    doesExist(user.id, function(body) {

      //If they do, update their player file with the results of the game
      if(body.exists) {
        console.log("Player already exists in the database. Updating player file.");

        body.data.wins += user.wins;
        body.data.losses += user.losses;
        body.data.goalsFor += user.goalsFor;
        body.data.goalsAgainst += user.goalsAgainst;
        body.data.totalGames = body.data.wins + body.data.losses;

        players.insert(body.data, function(err) {
          if(err) {
            console.log(err);
          } else {
            console.log("User updated");
          }
        })

      //If they don't exist in the players database, add them to it.
      } else {

        console.log("Player does not exist. Adding to Players database.");

        user.totalGames += 1;

        players.insert(user, function(err) {

          if(err) {
            console.log(err);
          } else {
            console.log("User stored");
          }
        });
      }
    });
  }

  callback();
}

//Gets the index of the last game played.
function getLastGameID(callback) {

  games.list(function(err, body) {

    if(err) {
      console.log(err);
    }

    lastIndex = body.total_rows;
  });

  callback(lastIndex);
}

//Check to see if the player exists in the database
function doesExist(twitterID, callback) {

  //We label players by their numerical Twitter ID.
  //If a player has logged into Twitter, they will have a Twitter ID.
  if(twitterID) {

    //Go through the players and see if they exist. If they do, grab the player file and send it to be updated
    players.view('Players', 'getPlayers',{"include_docs": true}, function(err, body) {

      for(var i=0; i<body.rows.length; i++) {
        if(body.rows[i].value == twitterID) {

          playerFile = body.rows[i].doc;
          exists = true;
          break;
        }
      }

      if(exists) {
        callback({"exists": true, "data": playerFile});
      } else {
        callback({"exists": false, "data": "No user exists"});
      }

    });

  }

}

//Gets all the players in the league. Sends an array of all players in the database
function getLeague(callback) {

    players.view('Players', 'getPlayers', {"include_docs": true}, function(err, body) {
      league = body.rows;
      callback(league);
    });


}

//Checks if the players database has been created.
//This is to stop the league table from querying a database that doesn't exist yet.
function isCreated(callback) {
  var created = "";

  cloudant.db.list(function(err, databases) {

    if(databases.indexOf('players') == -1) {
      created = false;
    } else {
      created = true;
    }
    callback(created);
  });
}

module.exports = new database();

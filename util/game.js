//game.js
//Author: Oliver Rodriguez

//These functions are used to interact with the GameFile

//constructor
function Game () {
	this.loggedIn= loggedIn;
	this.startGame= startGame;
	this.endGame= endGame;
	this.resetGame= resetGame;
	this.goal= goal;
	this.goalTime= goalTime;
	this.clearGameFile= clearGameFile;
	this.isOld= isOld;
}

//This is to keep track of who is logged in. We don't want 2 people trying to log into the same player.
var loggedIn = {
	player1: false,
	player2: false
}

//Function that starts the game. Sets start time and gameActive to true
function startGame (gameFile) {

	if (!gameFile.gameActive) {

		gameFile.start = getTime();
		gameFile.gameActive = true;
		console.log("Starting Game");

	} else {

		console.log("Game is already active. Reseting game instead.");
		resetGame(gameFile);

	}
}

//Function that ends the game. Sets the end time and gameActive to false.
function endGame (gameFile, callback) {

	if (gameFile.gameActive) {

		gameFile.end = getTime();
		gameFile.gameActive = false;
		loggedIn.player1 = false;
		loggedIn.player2 = false;
		console.log("Game Ended");
		console.log(gameFile);

	} else {

		console.log("No game is active right now");
		return false;

	}
	callback();
}

//Function that resets the game if one is currently active.
//Will start a game if no game is active already
function resetGame(gameFile) {

	if (gameFile.gameActive) {

		endGame(gameFile);
		clearGameFile(gameFile);
		startGame(gameFile);

	} else {

		console.log("No game is active right now. Starting game instead.");
		startGame(gameFile);

	}
}

//Handle goal events. Updates both the gamefile and the player objects
function goal(gameFile, userGoalFor, userGoalAgainst, team) {

	if (team == 1) {

		gameFile.goalsTeam1++;

	} else if (team == 2) {

		gameFile.goalsTeam2++;

	}

	userGoalFor.goalsFor++;
	userGoalAgainst.goalsAgainst++;
	goalTime(gameFile);

}

//Sets the time at which the last goal was scored.
function goalTime (gameFile) {

	gameFile.lastBall = getTime();
}

//Sets the gameFile back to default values
function clearGameFile(gameFile) {

	gameFile.gameID = "";
	gameFile.start = "";
	gameFile.end = "";
	gameFile.gameActive = false;
	gameFile.lastBall = "";
	gameFile.goalsTeam1 = 0;
	gameFile.goalsTeam2 = 0;
	gameFile.userTeam1 = "Player 1";
	gameFile.userTeam2 = "Player 2";
	gameFile.IDTeam1 = "";
	gameFile.IDTeam2 = "";

}

//This function determins if a game is old or not. Old is considered longer that 20 minutes without a goal scored.
function isOld (gameFile) {

	var lMins = Math.round(gameFile.lastBall / 60000);
	var cMins = Math.round(getTime() / 60000);
	var sMins = Math.round(getTime() / 60000);

	if(cMins - lMins <= 20 || cMins - sMins <= 20) {
		return false;
	} else {
		return true;
	}
}

//Quick function that returns timestamp in miliseconds
function getTime () {

	var d = new Date();
	var ts = d.getTime();
	return ts;

}

module.exports = new Game();

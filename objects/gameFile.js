//Game File object

//Constructor for building the game file
//The game file is how we keep track of the players and goals in a game
function GameFile () {
	this.gameID = "";
	this.start = "";
	this.end = "";
	this.gameActive = false;
	this.lastBall = "";
	this.goalsTeam1 = 0;
	this.goalsTeam2 = 0;
	this.userTeam1 = "Player 1";
	this.userTeam2 = "Player 2";
	this.IDTeam1 = "";
	this.IDTeam2 = "";
}

module.exports = GameFile;

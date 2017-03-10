//User.js
//Author: Oliver Rodriguez
//This user object is how we keep track of the users that play

//Constructor for building the User
function User () {
  this.id = "";
  this.name = "";
  this.handle = "";
  this.photo = "/images/player.svg";
  this.wins = 0;
  this.losses = 0;
  this.goalsFor = 0;
  this.goalsAgainst = 0;
  this.totalGames = this.wins + this.losses;
  this.location = "";
}

module.exports = User;

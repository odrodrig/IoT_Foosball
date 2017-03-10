/*
*
*
*    ______   ______     ______     ______     ______     __  __     ______     ______
*   /\  ___\ /\  __ \   /\  __ \   /\  ___\   /\  == \   /\ \/\ \   /\___  \   /\___  \
*   \ \  __\ \ \ \/\ \  \ \ \/\ \  \ \___  \  \ \  __<   \ \ \_\ \  \/_/  /__  \/_/  /__
*    \ \_\    \ \_____\  \ \_____\  \/\_____\  \ \_____\  \ \_____\   /\_____\   /\_____\
*     \/_/     \/_____/   \/_____/   \/_____/   \/_____/   \/_____/   \/_____/   \/_____/
*
*       An IoT connected foosball table powered by Watson IoT, Cloudant, and Node-RED
*/

/*eslint-env browser, jquery*/
/*globals Timeline timeline:true*/

//TODO Will probably delete this
// You will need to know which sensor maps to which team color.
var team1 = 'Yellow'; //TODO Change to match your Team One color
var team2 = 'Black'; //TODO Change to match your Team Two color

// Declare user information variables
var userOne;
var userTwo;
var userOnePhoto;
var userTwoPhoto;
var timeline_data;

// Main javascript for handling game events, login, tweets, and league rendering
$(document).ready(function() {

    var socket = io();

    //Disable reset game on page load
    $("#end").hide();
    $("#rematch").hide();

    //Declare variables
    var currentDate = new Date();
    var scoreOne;
    var scoreTwo;
    var shooter;
    var team;
    var gameActive;
    var goalOne;
    var goalTwo;

    // //Variable for probability
    // var probTeamOne;
    // var flip;

    //Initiate first element in timeline
    timeline_data = [{
        date: new Date(),
        title: ' ',
        content: 'Welcome to Foosbuzz, powered by Bluemix!'
    }];
    reloadTimeline();

    // //Get initial probability
    // $.get('/probability', function(res) {
    //     probTeamOne = res.probTeamOne;
    //     flip = res.flip;
    //
    //     if (probTeamOne === null) {
    //             console.log("Probability is undefined");
    //     } else if (flip===true){
    //             $('#probTeamTwo').html((probTeamOne[0][0] * 100).toFixed(1) + "%");
    //             $('#probTeamOne').html(((1 - probTeamOne[0][0]) * 100).toFixed(1) + "%");
    //             $('#probval').show();
    //     } else {
    //             $('#probTeamOne').html((probTeamOne[0][0] * 100).toFixed(1) + "%");
    //             $('#probTeamTwo').html(((1 - probTeamOne[0][0]) * 100).toFixed(1) + "%");
    //             $('#probval').show();
    //     }
    // });

    //Load the current game if one
    currentGame();

    /*
     *
     * RENDER THE LEAGUE TABLE USING CLOUDANT DATA
     *
     */

  //League data from server
	var table = $('#leaguetable').DataTable({
		"processing": true,
		"ajax": "league",
		"iDisplayLength": 100,
		"order": [[ 8, 'desc' ],[7, 'desc' ] ], //sort by points, then GD
		"aoColumnDefs": [
			{ "sClass": "photo-column", "aTargets": [ 0 ] },
			{ "sClass": "user-column", "aTargets": [ 1 ] },
			{ "sClass": "company-column", "aTargets": [ 2 ] }
		],
	    "bLengthChange": false,
		"columns": [
			{ data: 'photo' },
			{ data: 'username' },
			{ data: 'handle' },
			{ data: 'games' },
			{ data: 'won' },
			{ data: 'lost' },
			{ data: 'goalSpread' },
			{ data: 'goalDiff' },
			{ data: 'points' }
		],
		"fnDrawCallback" : function() {
			$(".photo-column > img").attr('height','100px');
			$(".photo-column > img").attr('width','100px');
		}
	});

	setInterval( function () {
 		table.ajax.reload();
		console.log("Reloading league");
	}, 90000 );

	$('#leaguetable tbody').on( 'click', 'tr', function () {
		console.log( table.row( this ).data() );
	});

	$.fn.dataTable.ext.errMode = 'throw';


    /*
     *
     * BROWSER BUTTON EVENTS
     *
     */

    //End button in browser hit
    $("#end").click(function() {
        console.log("Ending Game!");
        $.get('/end', function() {});
        gameEnd();
    });

    //Rematch button hit
    $("#rematch").click(function() {
        //Disable reset game
        $("#end").show();
        $("#rematch").hide();
        $.get('/rematch', function() {});
        gameStart();
    });

    /*
     *
     * SOCKET EVENTS
     *
     */
    socket.on("connect", function() {
        console.log('WebSocket Client Connected');
        //currentGame();
    });

    socket.on("reset", function() {
        console.log("Game Reset");
        history.go(0);
    });

    socket.on("endGame", function() {
      console.log("Game Ended");
      gameEnd();
    });

    socket.on("gameWon", function(data) {
      gameWin(data);
    });

    socket.on("gameStart", function(data) {
      console.log("Game Started");
      gameStart();
    });

    socket.on("goal", function(msg) {
        console.log(msg);

        console.log("Goal scored!");
        goalScored(msg);

        // switch (data.type) {
        //     case "newGame":
        //         console.log("New game started");
        //         currentGame();
        //     break;
        //     case "goal":
        //         console.log("Goal score received");
        //         goalScored(data);
        //     break;
        //     case "gameWon":
        //         console.log("Game win received");
        //         gameWin(data);
        //     break;
        //     case "endGame":
        //         console.log("Ending game");
        //         gameEnd();
        //     break;
        //     case "LoginPlayerOne":
        //         console.log("Player for team "+team1+" has logged in.");
        //         LoginPlayerOne(data);
        //     break;
        //     case "LoginPlayerTwo":
        //         console.log("Player for team "+team2+" has logged in.");
        //         LoginPlayerTwo(data);
        //     break;
        //     case "DuplicateLogin":
        //         console.log("Duplicate login detected");
        //         currentGame();
        //     break;
        // } //End switch
    });

    socket.on("login", function(data) {

      if(data.team == 1) {
        LoginPlayerOne(data.player);
      } else if(data.team == 2) {
        LoginPlayerTwo(data.player);
      }

    });

    socket.on("close", function() {
            console.log("Socket.io not connected");
            //setTimeout(socketConnect,5000);
    });

    /*
     *
     * FUNCTIONS
     *
     */
    function currentGame(){
        //Check if a game is open. If it is load the page with the user's data.
        $.get('/currentGame', function(res) {

            console.log(res);

            //Same game status from server to client variable
            gameActive = res.game.gameActive;

            if (gameActive==true) {

                //There are players logged in
                $("#nameOne").html(res.game.userTeam1);
                $("#imageOne").attr("src", res.players.player1.photo);
                $("#imageOne").attr("class","avatar alt");
                $("#ScoreOne").html(res.game.goalsTeam1);
                $("#nameTwo").html(res.game.userTeam2);
                $("#imageTwo").attr("src", res.players.player2.photo);
                $("#imageTwo").attr("class","avatar alt");
                $("#ScoreTwo").html(res.game.goalsTeam2);
                $('#LoginButtonOne').hide();
                $('#LoginButtonTwo').hide();
                $("#end").show();


                //Set the goals to the current goals from Cloudant
                goalOne = res.game.goalsTeam1;
                goalTwo = res.game.goalsTeam2;

    //             //Get initial probability
    //             $.get('/probability', function(res) {
    //                 probTeamOne = res.probTeamOne;
    //                 flip = res.flip;
    //                 console.log("Probability Team One: " + res);
    //                 //Show probability
    //                 if (probTeamOne === null) {
    //                     console.log("Probability is undefined");
    //                 } else if (flip===true){
    //                     $('#probTeamTwo').html((probTeamOne[goalOne][goalTwo] * 100).toFixed(1) + "%");
    //                     $('#probTeamOne').html(((1 - probTeamOne[goalOne][goalTwo]) * 100).toFixed(1) + "%");
    //                     $('#probval').show();
    //                 }else {
    //                     $('#probTeamOne').html((probTeamOne[goalOne][goalTwo] * 100).toFixed(1) + "%");
    //                     $('#probTeamTwo').html(((1 - probTeamOne[goalOne][goalTwo]) * 100).toFixed(1) + "%");
    //                     $('#probval').show();
    //                 }
    //             }); //End probability

                //Player One is not logged in, set to defaults
                if (res.game.userTeam1 == "Player 1") {
                    userDefault(team1, "One");
                    $("#ScoreOne").html(res.game.goalsTeam1);
                }

                //Player Two is not logged in, set to defaults
                if (res.game.userTeam2 == "Player 2") {
                    userDefault(team2, "Two");
                    $("#ScoreTwo").html(res.game.goalsTeam2);
                }
            } else {
                userDefault(team1, "One");
                userDefault(team2, "Two");
                $("#ScoreOne").html("0");
                $("#ScoreTwo").html("0");
                // $("#probTeamOne").html("0.00%");
                // $("#probTeamTwo").html("0.00%");
            }
        });
    }

    function goalScored(data) {
         scoreOne = data.game.goalsTeam1;
         scoreTwo = data.game.goalsTeam2;
         team = data.team;

         //Set team name for scoring team
         if(team==1){
            team = team1;
            shooter = data.game.userTeam1;
            console.log("goal Team 1");
        }
        if(team==2){
            team = team2;
            shooter = data.game.userTeam2;
            console.log("goal Team 2");
        }

        $("#end").show();
        $("#ScoreOne").html(scoreOne);
        $("#ScoreTwo").html(scoreTwo);

        // //Get probability
        // $.get('/probability', function(res) {
        //     probTeamOne = res.probTeamOne;
        //     flip = res.flip;
        //
        //     console.log("Probability Team One: " + res);
        //     //Show probability
        //     if (probTeamOne === null) {
        //         console.log(
        //             "Probability is undefined");
        //     } else if (flip===true){
        //         $('#probTeamTwo').html((probTeamOne[goalOne][goalTwo] * 100).toFixed(1) + "%");
        //         $('#probTeamOne').html(((1 - probTeamOne[goalOne][goalTwo]) * 100).toFixed(1) + "%");
        //         $('#probval').show();
        //     }else {
        //         $('#probTeamOne').html((probTeamOne[servOne][servTwo] * 100).toFixed(1) + "%");
        //         $('#probTeamTwo').html(((1 - probTeamOne[servOne][servTwo]) * 100).toFixed(1) + "%");
        //         $('#probval').show();
        //     }
        // });

        //Display timeline event with shooter's name
        if (shooter != "Player 1" || shooter != "Player 2") {
            timeline_data.push({
                date: new Date(),
                title: 'Goal!',
                content: "Team " + team + " Captain " + shooter + " scores!"
            });
            reloadTimeline();
        } else {

            //Report new score
            timeline_data.push({
                date: new Date(),
                title: 'Goal!',
                content: team + ' team scores!'
            });
            reloadTimeline();

        }
    } //End goalScored

    //Player One has logged in, load attributes of player if an actual person
    function LoginPlayerOne(data){
        if (data.name != 'Player 1' || data.name != null) {
            userOne = data.name;
            userOnePhoto = data.photo;
            console.log(userOnePhoto);
            $("#nameOne").html(userOne);
            $("#imageOne").attr("src", userOnePhoto);
            $("#imageTwo").attr("class","avatar alt");
            //Hide login button to prevent others from logging in
            $('#LoginButtonOne').hide();
            timeline_data.push({
                date: new Date(),
                title: 'Team ' + team1 + ' Logged In',
                content: data.name +' playing for Team ' + team1
            });
            reloadTimeline();
        }
    }
    //Player Two has logged in, load attributes of player if an actual person
    function LoginPlayerTwo(data) {
        if (data.name !== 'Player 2' || data.name !== null) {
            userTwo = data.name;
            userTwoPhoto = data.photo;
            $("#nameTwo").html(userTwo);
            $("#imageTwo").attr("src", userTwoPhoto);
            $("#imageTwo").attr("class","avatar alt");
            //Hide login button to prevent others from logging in
            $('#LoginButtonTwo').hide();
            timeline_data.push({
                date: new Date(),
                title: 'Team ' + team2 + ' Logged In',
                content: data.name + ' playing for Team ' + team2
            });
            reloadTimeline();
        }
    }
    //Game is started either in browser or on the foosball table
    function gameStart() {
        $("#ScoreOne").html("0");
        $("#ScoreTwo").html("0");
        $("#end").show();
        //Report game start
        timeline_data.push({
            date: currentDate,
            title: 'Game Started!',
            content: 'A game has started, who will win? ' + team1 + ' or ' + team2 + '? Tweet your favorite team.'
        });
        reloadTimeline();
    }

    //Team won game
    function gameWin(data) {
        $("#ScoreOne").html(data.game.goalsTeam1);
        $("#ScoreTwo").html(data.game.goalsTeam2);

        $("#rematch").show();
        $("#end").show();

        if (data.team == 1) {
            team = team1;
        }
        if (data.team == 2) {
            team = team2;
        }

        //Report winner
        timeline_data.push({
            date: new Date(),
            title: 'Team ' + team + ' Wins!',
            content: 'Team ' + team +' wins! Game over. Rematch?'
        });
        reloadTimeline();
    }

    //Game Ended
    function gameEnd() {
        $("#end").hide();
        $("#rematch").hide();
        $("#probval").hide();

        //reset Team One to defaults
        userDefault(team1, "One");
        userOne = "Captain " + team1;
        $("#ScoreOne").html("0");

        //reset Team Two to defaults
        userDefault(team2, "Two");
        userTwo = "Captain " + team2;
        $("#ScoreTwo").html("0");

        //Report game over
        timeline_data.push({
            date: new Date(),
            title: 'Game End',
            content: 'Game over! Log in to play.'
        });
        reloadTimeline();
    }

    //Set default parameters for each team
    function userDefault(team, text) {
        $("#name" + text).html("Captain " + team);
        $("#image" + text).attr("src", '../images/player.svg');
        $("#image" + text).attr("class","avatar");
        $('#LoginButton' + text).show();
    }

    //Setup for all new timeline events
    function reloadTimeline() {
        $("#timeline").load('index.html #timeline', function() {
            timeline = new Timeline($('#timeline'),
                timeline_data);
            timeline.display();
        });
    }

});

$(function() {

  var socket = io();

  socket.on('goal', function(data) {

    console.log(data.team);
    console.log("score!")
  });

  socket.on('reset', function(data) {

    console.log('Game has been reset');
  })

});

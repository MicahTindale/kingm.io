const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const app = express();
const path = require('path');
__dirname = path.resolve(path.dirname(''));
const FFA_LIMIT = 10;
const PUBLIC_TEAMS_LIMIT = 16;
const GAME_END_SCORE = 5000;
var current_ffa_server = "";


app.set('view engine', '.ejs');
app.set('views', path.join(__dirname, 'views'));
app.use("/public", express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//routing
app.get('/', (req, res) => {
  res.render('join.ejs')
});
app.get('/updates', (req, res) => {
  res.render('updates.ejs')
});


app.post('/join_game', (req, res) => {
  var name = req.body.name;
  var mode = req.body.mode;
  var s = undefined; 
  if(mode === "/ffa"){
 s = findFreeFFA().nsps.name;
}else if(mode === "/teams_p"){
  s = findFreeTeamPublic().nsps.name;
}else if (mode === "teams_pr"){
 
}
  res.render('main.ejs', {name: name, server: s});
});

var port = process.env.PORT || 3000;
var server = app.listen(port, () => {
  console.log('server started');
});

//socket.io

var io = require('socket.io')(server);


//setting up servers

var PUBLIC_TEAMS = [];

function findFreeTeamPublic(){
  var freePublicTeams = undefined;
  for(p in PUBLIC_TEAMS){
    if(!PUBLIC_TEAMS[p].started && PUBLIC_TEAMS[p].players.length <= PUBLIC_TEAMS_LIMIT){
      freePublicTeams = PUBLIC_TEAMS[p];
      break;
    }
  }

  if(freePublicTeams != undefined){
  }else{
    freePublicTeams = new Unique_Server("/PUBLIC" + PUBLIC_TEAMS.length, "teams");
    PUBLIC_TEAMS.push(freePublicTeams);
  }
  return freePublicTeams;
}

var FFAs = [];

function findFreeFFA(){
  var freeFFA = undefined;
  for(x in FFAs){
    if(FFAs[x].players.length <= FFA_LIMIT){
      freeFFA = FFAs[x];
	  break;
    }
  }
  if(freeFFA != undefined){
  }else{
    freeFFA = new Unique_Server("/FFA" + FFAs.length, "ffa");
    FFAs.push(freeFFA);
  }
  return freeFFA;
}

function Unique_Server(namespace, mode){
  this.nsps = io.of(namespace);
  this.players = [];
  if(mode === "ffa"){
  this.started = true;
  }else{
    this.started = false;
  }
  new setUpServer(this.nsps, mode, this);
}


//game logic & continued server setup
function setUpServer(serverVAR, mode, svr){
var players = svr.players;
var gamemode = mode;
var teamToReturn = "red";

 var game_obj = undefined;
 var hill_obj = undefined;
 var speedHillObj = undefined;
var regenHillObj = undefined;
var game = new Game(gamemode);
var arrows = new Array();
//walls
if(gamemode === "teams"){
  //BASE WALLS
game.walls.push(new Wall(redEdge(game) - 100, 0, 100, 300));
game.walls.push(new Wall(blueEdge(game), 0, 100, 300));
game.walls.push(new Wall(redEdge(game) - 100, game.height - 300, 100, 300));
game.walls.push(new Wall(blueEdge(game), game.height - 300, 100, 300));
game.walls.push(new Wall(redEdge(game) - 100, 600, 100, game.height - 1200));
game.walls.push(new Wall(blueEdge(game), 600, 100, game.height - 1200));

//SPEED AND REGEN WALLS
game.walls.push(new Wall(game.regenHill.x - game.regenHill.size/2, game.regenHill.y - game.regenHill.size/2 - 50, game.regenHill.size, 50));

game.walls.push(new Wall(game.speedHill.x - game.speedHill.size/2, game.speedHill.y + game.speedHill.size/2, game.speedHill.size, 50));
}else{
  game.walls.push(new Wall(game.blueStore.x - 200, game.blueStore.y - 100, 100, game.blueStore.height + 100));
  game.walls.push(new Wall(game.blueStore.x + game.blueStore.width + 100, game.blueStore.y - 100, 100, game.blueStore.height + 100));
  
  game.walls.push(new Wall(game.redStore.x - 200, game.redStore.y, 100, game.redStore.height + 100));
  game.walls.push(new Wall(game.redStore.x + game.redStore.width + 100, game.redStore.y, 100, game.redStore.height + 100));
  
  
}

//WALLS AT Hill
game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game,"top"), 20, game.hill.size / 3));
game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game,"bottom") - game.hill.size/3, 20, game.hill.size / 3));
game.walls.push(new Wall(getEdgeOfHill(game, "right"), getEdgeOfHill(game, "top"), 20, game.hill.size / 3));
game.walls.push(new Wall(getEdgeOfHill(game, "right"), getEdgeOfHill(game, "bottom") - game.hill.size/ 3, 20, game.hill.size / 3));

game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game, "top") - 20, game.hill.size / 3, 20));
game.walls.push(new Wall(getEdgeOfHill(game, "right") - game.hill.size / 3, getEdgeOfHill(game, "top") - 20, game.hill.size / 3 + 20, 20));
game.walls.push(new Wall(getEdgeOfHill(game, "left") - 20, getEdgeOfHill(game, "bottom"), game.hill.size / 3, 20));
game.walls.push(new Wall(getEdgeOfHill(game, "right") - game.hill.size / 3, getEdgeOfHill(game, "bottom"), game.hill.size / 3 + 20, 20));



//server side game update
setInterval(function(){
game.time += 1;

if(gamemode === "teams"){
  if(game.redScore >= GAME_END_SCORE && svr.started){
    serverVAR.emit("end_game", "red");
    game.blueScore = 0;
    game.redScore = 0;
    game.hill.capturingTeam = "none";
    game.hill.percentageCaptured = 0;
    svr.started = false;
  }else if(game.blueScore >= GAME_END_SCORE && svr.started){
    serverVAR.emit("end_game", "blue");
    game.blueScore = 0;
    game.redScore = 0; 
    game.hill.capturingTeam = "none";
    game.hill.percentageCaptured = 0;
    svr.started = false;
  }
}


for(var i = 0; i < 6; i++){
  updateArrows(arrows);
  var playersLeaving = [];
  for(p in players){
	  players[p].idleTime++;
	  console.log(players[p].idleTime);
	  
	if(players[p].idleTime > 60 * 30){
	sendMessageToNamespace(serverVAR, "SERVER", players[p].playerName + " has been kicked from the game.", "");
	playersLeaving.push(players[p]);
	}
    var toRemove = [];
    for(a in arrows){
      var ar = arrows[a];
      var ray = getNormalizedRay(ar.rotation);
      var newX = ar.x + ray.x*30;
      var newY = ar.y + ray.y*30;
     if(checkIfIntersectionWithWalls(game, ar)){
        toRemove.push(a);
     }else{
      if(dist(newX, newY, players[p].x , players[p].y) < players[p].size * 1.1){
        if(gamemode === "teams"){
          if(ar.from_team != players[p].team){
             toRemove.push(a);
             var armor = game.redStore.armor_upgrades[players[p]  .selected_armor];
               players[p].health -= 15 * (1 - armor.reduced_damage);
               if(players[p].health <= 0){
                respawnPlayer(players[p], game); 
                
                var p1ds = findPlayer(players, ar.from_player_id);
                if(p1ds != undefined){
                  p1ds.money += 100;
                  sendMessageToNamespace(serverVAR, "SERVER", players[p].playerName + " was annihilated by " + p1ds.playerName, "");
                }
               };
          }
        }else if (gamemode === "ffa"){
             toRemove.push(a);
             var armor = game.redStore.armor_upgrades[players[p]  .selected_armor];
             if(!playerInSafeZone(players[p], game)){
               players[p].health -= 15 * (1 - armor.reduced_damage);
              if(players[p].health <= 0){
                respawnPlayer(players[p], game); 
                var p1ds = findPlayer(players, ar.from_player_id);
                if(p1ds != undefined){
                  p1ds.money += 100;
                  sendMessageToNamespace(serverVAR, "SERVER", players[p].playerName + " was annihilated by " + p1ds.playerName, "");
                }
              }
             }
          
        }
       
      
      }
      }
     
    }
    for(x in toRemove){
      arrows.splice(toRemove[x], 1);
    }
  }
  for(x in players){
    playerLeaving(players[x].key, players, serverVAR);
  }
  
  }
  for(p in players){
    if(players[p].isBowTime){
    players[p].bow_animation_timer++;
    }else{
      players[p].bow_animation_timer = 0;
    }
    if(game.time % 100 === 0){
      if(players[p]!= undefined){
        if(gamemode === "ffa"){
			if(!playerInSafeZone(players[p], game)){
          players[p].money += 10;
			}
        }else{
          if(svr.started){
          players[p].money += 10;
          }
        }
      }
    }
  performCollisionDetection(players[p], game);
  game = updateHill(players[p], game, gamemode);
  if(players[p].health < players[p].maxHealth){
    if(players[p].team === game.regenHill.capturingTeam && game.regenHill.percentageCaptured >= 1){
      players[p].health += 0.03 * 2;
    } else{
      players[p].health += 0.03;
    }
    if(gamemode === "ffa" && playerInSafeZone(players[p], game)){
      players[p].health -= 0.03;
    }

    if(gamemode === "teams"){
    if(players[p].team === "red"){
      if(players[p].x < game.redPercentage * game.width){
        players[p].health += 0.05;
      }
    }else{
      if(players[p].x > game.width - (game.bluePercentage * game.width)){
        players[p].health += 0.05;
      }
    }
    }
  }

}
 game_obj = {blueScore: game.blueScore, redScore: game.redScore};
 hill_obj = {capturingTeam: game.hill.capturingTeam, percentageCaptured: game.hill.percentageCaptured};
  speedHillObj = {c_team: game.speedHill.capturingTeam, p_c: game.speedHill.percentageCaptured};
  
  regenHillObj = {c_team_1: game.regenHill.capturingTeam, p_c_1: game.regenHill.percentageCaptured};
  
serverVAR.emit("updateAllPositions", {players: JSON.stringify(players),game: game_obj, hill: hill_obj, arrows: JSON.stringify(arrows), speedHill: speedHillObj, regenHill: regenHillObj});


if(game.time % 40 == 0 && gamemode === "ffa"){
  var arr = players.concat();
  arr.sort(function(a, b){
    return b.score - a.score;
  });
  var toSend = [];
  for(a in arr){
    toSend[a] = {name: arr[a].playerName, score: arr[a].score};
  }
  serverVAR.emit("scores", JSON.stringify(toSend));
}

if(players.length <= 0 && gamemode === "teams"){
  game.blueScore = 0;
    game.redScore = 0; 
    game.hill.capturingTeam = "none";
    game.hill.percentageCaptured = 0;
    svr.started = false;
}
  svr.players = players;


}, 1000/30);

//connection
serverVAR.on('connection', function(socket){
  console.log("THERE HAS BEEN A CONNECTION");
  socket.on("disconnect", function(){
    playerLeaving(socket.id, players, serverVAR);
  });
  socket.on('leaving', function(key){
    playerLeaving(key, players, serverVAR);
  });
console.log("User has been connected to " + serverVAR.name);
  socket.on('info', function(info){
   var name = info.name.replace(/^\s+|\s+$/, "");
      sendMessageToNamespace(serverVAR, "SERVER", name + " has joined the game", "");
    socket.on("message", function(msg){
      sendMessageToNamespace(serverVAR, name, msg, socket.id);
   });
if (!name || name.length > 20) {
name = name.slice(0, 20);
}
  var t = teamToReturn;
  if(gamemode === "ffa"){
    t = "red";
  }
  var newPlayer = new player(name, game, t);
  if(teamToReturn === "red"){
    teamToReturn = "blue";
  }else{
    teamToReturn = "red";
  }
  newPlayer.key = socket.id;
  var newPos = getPosition(newPlayer.team, game);
  if(gamemode === "ffa"){
    var team = "";
    if(Math.random() > 0.5){
      team = "red";
    }else{
      team = "blue";
    }
    newPos = getPosition(team, game);
    newPlayer.team = "red";
  }
  newPlayer.x = newPos.x;
  newPlayer.y = newPos.y;
   newPlayer.targetX = newPos.x;
  newPlayer.targetY = newPos.y;
  players.push(newPlayer);
  socket.emit('uniqueKey', {key: newPlayer.key, game: game, started: svr.started});
  serverVAR.emit("playerUpdate", players);
  if(gamemode === "teams" && players.length >= PUBLIC_TEAMS_LIMIT){
     startGame(svr, serverVAR, game);
  }

});
socket.on("bow_start", function(){
  var player = findPlayer(players, socket.id);
  if(player != undefined){
    player.isBowTime = true;
  serverVAR.emit("bow_s", socket.id);
  }
});

socket.on("bow_end", function(num){
  serverVAR.emit("bow_e", socket.id);
  var player = findPlayer(players, socket.id);
  if(player != undefined && num >= 20 && !playerInSafeZone(player, game)){
    var ray = getNormalizedRay(player.rotation);
    arrows.push(new Arrow(player.x - (ray.y * 42), player.y - (-ray.x * 42), {x: ray.x, y: ray.y}, player.rotation, player.team, player.key));
    player.isBowTime = false;
  }
});

socket.on("hit", function(sword_id){
  socket.broadcast.emit("hit_anim", socket.id);
  var player = findPlayer(players, socket.id);
  if(player != undefined){
  for(p in players){
    if(players[p] != player){
   doHit(players,p, player, game, sword_id, game.redStore.sword_upgrades);
    }
   if(players[p].health <= 0){
     respawnPlayer(players[p], game);
     player.money += 100;
     sendMessageToNamespace(serverVAR, "SERVER", players[p].playerName + " couldn't handle " + player.playerName + "'s sword", "");
   
   }
  }
  }
});
socket.on("request_buy", function(id){
  var player = findPlayer(players, socket.id);
  if(player.money >= game.redStore.sword_upgrades[id].price){
    player.money -= game.redStore.sword_upgrades[id].price;
    socket.emit("new_sword", {id: id, money: player.money});
  }
});
socket.on("sword_u", function(info){
  var player = findPlayer(players, socket.id);
    if(player != undefined){
        player.selected_sword = info.sword;
        player.mode = "sword";
        socket.broadcast.emit("sword_update", info);
    }
});
socket.on("bow_u", function(info){
  var player = findPlayer(players, socket.id);
    if(player != undefined){
        player.selected_bow = info.sword;
        player.mode = "bow";
        socket.broadcast.emit("bow_update", info);
    }
});
socket.on("mode", function(mode){
  var player = findPlayer(players, socket.id);
    if(player != undefined){
       player.mode = mode;
    }
});

socket.on("requestPlayerUpdate", function(){
  
  socket.emit("playerUpdate", players);
});
socket.on('position', function(info){
var player = findPlayer(players, info.key)
if(player != undefined){

if(player.team === game.speedHill.capturingTeam && game.speedHill.percentageCaptured >= 1){
  info.xIncrease *= 1.3;
  info.yIncrease *= 1.3;
}

player.targetX = player.x + (info.xIncrease);
player.targetY = player.y + info.yIncrease;
player.x += info.xIncrease;
player.y += info.yIncrease;
wallCollisionAndResponse(player, game, info);
player.idleTime = 0;
}
});
socket.on("armor_u", function(id){
  var player = findPlayer(players, socket.id);
  if(player != undefined){
    player.selected_armor = id.sword;
  }
});
socket.on("request_buy_armor", function(id){
  var player = findPlayer(players, socket.id);
  if(player != undefined){
    if(player.money >= game.redStore.armor_upgrades[id].price){
      player.money -= game.redStore.armor_upgrades[id].price;
      socket.emit("new_armor", {money: player.money, id: id});
    }
  }
});
socket.on('rotation', function(info){
  var player = findPlayer(players, info.key);
  if(player != undefined){
  player.targetRotation = info.rot;
  player.rotation = player.targetRotation;
  }
});
socket.on("start_game", function(){
 startGame(svr, serverVAR, game);
});

});
}
function startGame(svr, serverVAR, game){
    if(svr.started != true){
    console.log("STARTING GAME");
    svr.started = true;
    startTeamsGame(game, svr);
    serverVAR.emit("start", {});
  }
}

function dist(x1, y1, x2, y2){
  var a = x1 - x2;
var b = y1 - y2;

var c = Math.sqrt( a*a + b*b );
  return c;     
}

function playerInSafeZone(player, game){
  var is = false;
  if(player.x - player.size > game.redStore.x - 100 && player.x + player.size < game.redStore.x + game.redStore.width + 100 && player.y - player.size > game.redStore.y && player.y + player.size < game.redStore.y + game.redStore.height + 100){
    is = true;
  }
  else if(player.x - player.size > game.blueStore.x - 100 && player.x + player.size < game.blueStore.x + game.blueStore.width + 100 && player.y - player.size > game.blueStore.y - 100 && player.y + player.size < game.blueStore.y + game.blueStore.height){
    is = true;
  }
  return is;
}

function doHit(players,p, player, game, sword_id, swords){
  var sword = swords[sword_id];
   if(players[p] != undefined){
     var doIt = false;
    if(game.mode === "ffa"){
      if(!playerInSafeZone(players[p], game) && !playerInSafeZone(player, game)){
      doIt = true;
      }
    }else{
      if(players[p].team != player.team){
      doIt = true;
      }
    }

    if(doIt){
      var d = dist(player.x, player.y, players[p].x, players[p].y);
      if(d < sword.attack_range){
      var ray = getNormalizedRay(player.rotation);
     

      var p1 = {x: player.x + ray.x * d, y: player.y + ray.y * d};

      var d5 = dist(players[p].x, players[p].y, p1.x, p1.y);
     
      var angleBetweenPlayers = angle(player.x, player.y, players[p].x, players[p].y);
      var rot = player.rotation;
      var rot2 = angleBetweenPlayers;

      var d3 = Math.abs(rot2 - ((rot - 90) % 360));

      if(d5 < players[p].size * 1.5){
        var armor = game.redStore.armor_upgrades[players[p].selected_armor];
        players[p].health -= (10 * sword.attack_power * (1 - armor.reduced_damage));
        players[p].targetX += sword.knockback * (ray.x * d);
        players[p].targetY += sword.knockback * (ray.y * d);
        players[p].x = players[p].targetX;
        players[p].y = players[p].targetY;
        wallCollisionAndResponse(players[p], game, {xIncrease: sword.knockback * (ray.x * d), yIncrease: sword.knockback * (ray.y * d)});
      }
      }

      
      }
    }
}

function updateArrows(arrows){
  var toRemove = [];
  for(a in arrows){
    if(arrows[a] != undefined){
    arrows[a].x += arrows[a].vel.x * (70/6);
    arrows[a].y += arrows[a].vel.y * (70/6);
    arrows[a].timer += 1/6;
    if(arrows[a].timer >= 15){
      toRemove.push(a);
    }
    }
  }
  for(x in toRemove){
    arrows.splice(toRemove[x], 1);
  }
}

function Arrow(x, y, vel, rot, ft, f_p_id){
  this.x = x;
  this.y = y;
  this.vel = vel; 
  this.rotation = rot;
  this.timer = 0;
  this.from_team = ft;
  this.from_player_id = f_p_id;
}

function getNormalizedRay(rotation){
  return {x: Math.sin(toRadians(rotation)), y: -Math.cos(toRadians(rotation))};
}
function toRadians (angle) {
  return angle * (Math.PI / 180);
}
function getDegrees(x, y){
  if(x > 0 && y == 0){
    return 90;
  }else if(x < 0 && y == 0){
    return 270;
  }else if(x == 0 && y > 0){
    return 180;
  }else if(x == 0 && y < 0){
    return 0;
  }else if(x > 0 && y > 0){
    return 135;
  }else if(x > 0 && y < 0){
    return 45;
  }else if(x < 0 && y > 0){
    return 225;
  }else {
    return 315;
  }
}

function startTeamsGame(game, svr){
  var tm = "red";
  for(a in svr.players){
    var pl = svr.players[a];
    if(tm === "red"){
     pl.team = "red";
    }else{
      pl.team = "blue";
    }
    var newPos = getPosition(pl.team, game);
    pl.x = newPos.x;
    pl.y = newPos.y;
    pl.targetX = newPos.x;
    pl.targetY = newPos.y;
     if(tm === "red"){
    tm = "blue";
   }else{
      tm = "red";
   }
  }
 

}

function generateRandomTeam(teamToReturn){
   if(teamToReturn === "red"){
     teamToReturn === "blue";
      return "red";
   }else{
     teamToReturn === "red";
     return "blue";
   }
}

function player(name, g, team){
this.key = "";
this.x = 0;
this.y = 0;
this.playerName = name;
this.targetX = 0;
this.targetY = 0;
this.size = 30;
this.money = 200;
this.team = team;
this.health = 100;
this.maxHealth = 100;
this.rotation = 0;
this.targetRotation = 0;
this.sword_animation_timer = 15;
this.bow_animation_timer = 0;
this.selected_sword = 0;
this.purchased_swords = [];
this.purchased_swords.push(0);
this.mode = "sword";
this.selected_bow = 0;
this.isBowTime = false;
this.selected_armor = 0;
this.score = 0;
this.idleTime = 0;
}
function getPosition(team, game){
  var rand = Math.random();
  var x = 0;
  var y = 30 + (rand * (game.height - 60));

  if(team === "red"){
    x = 50;
  }else{
    x = game.width - 50;
  }
  return {x: x,  y: y};
}
function respawnPlayer(player, game){
  var position = getPosition(player.team, game);
  if(game.mode === "ffa"){
    if(Math.random() > 0.5){
      position = getPosition("red", game);
    }else{
      position = getPosition("blue", game);
    }
    player.money = 200;
    player.score = 0;
  }
  player.x = position.x
  player.y = position.y;
  player.targetX = position.x;
  player.targetY = position.y;
  player.health = player.maxHealth;
 
}

function updateHill(p, g, gamemode){
var player = p;
  //MAIN HILL
  if(isPlayerOnHill(player, g, g.hill)){
    if(g.mode === "ffa"){
      player.score++;
    }else{

    if(g.hill.capturingTeam != player.team && g.hill.percentageCaptured > 0){
      g.hill.percentageCaptured -= 0.05;
    }else if(g.hill.capturingTeam != player.team){
      g.hill.capturingTeam = player.team;
      g.hill.percentageCaptured = 0;
    }else if(g.hill.capturingTeam === player.team && g.hill.percentageCaptured < 1){
      g.hill.percentageCaptured += 0.05;
    }else{
      if(g.hill.capturingTeam === "red"){
          g.redScore++;
      }else if(g.hill.capturingTeam === "blue"){
          g.blueScore++;
      }
    }
    }
  }
  if(gamemode === "teams"){
    //SPEED HILL
 if(isPlayerOnHill(player, g, g.speedHill)){
    if(g.speedHill.capturingTeam != player.team && g.speedHill.percentageCaptured > 0){
      g.speedHill.percentageCaptured -= 0.05;
    }else if(g.speedHill.capturingTeam != player.team){
      g.speedHill.capturingTeam = player.team;
      g.speedHill.percentageCaptured = 0;
    }else if(g.speedHill.capturingTeam === player.team && g.speedHill.percentageCaptured < 1){
      g.speedHill.percentageCaptured += 0.05;
    }
  
}
//REGEN HILL
 if(isPlayerOnHill(player, g, g.regenHill)){
    if(g.regenHill.capturingTeam != player.team && g.regenHill.percentageCaptured > 0){
      g.regenHill.percentageCaptured -= 0.05;
    }else if(g.regenHill.capturingTeam != player.team){
      g.regenHill.capturingTeam = player.team;
      g.regenHill.percentageCaptured = 0;
    }else if(g.regenHill.capturingTeam === player.team && g.regenHill.percentageCaptured < 1){
      g.regenHill.percentageCaptured += 0.05;
    }
  
}
  }

return g;
}

function findPlayer(list, key){
  return list.find(function(p){
    return key == p.key;
  });
}
function Game(mode){
  this.time = 0;
  this.width = 4000;
  this.height = 2000; 
  this.redPercentage = 0.2; 
  this.bluePercentage = 0.2; 
  this.walls = new Array();
  this.redScore = 0;
  this.blueScore = 0;
  this.hill = new Hill(this.width, this.height, 400);
  this.speedHill = new Hill(this.width, 200, 200);
  this.regenHill = new Hill(this.width, (this.height * 2) - 200, 200);
  var redStoreX = (this.redPercentage * this.width) - 300;
  if(mode === "ffa"){
    redStoreX = this.width/2 - 100;
  }
  this.redStore = new Store(redStoreX, 0, 200, 100);
  var blueStoreX = (this.width -(this.bluePercentage * this.width)) + 100;
  var blueStoreY = 0;
  if(mode === "ffa"){
    blueStoreY = this.height - 100;
    blueStoreX = this.width/2 - 100;
  }
  this.blueStore = new Store(blueStoreX, blueStoreY, 200, 100);
  this.mode = mode;
}

function Hill(width, height,size){
  this.x = width/2;
  this.y = height/2;
  this.capturingTeam = "none";
  this.percentageCaptured = 0;
  this.size = size; 
}
function checkIfIntersectionWithWalls(game, ar){
  var toReturn = false;
  for(w in game.walls){
    var wall = game.walls[w];
     if(ar.x > wall.x && ar.x < wall.x + wall.width && ar.y > wall.y && ar.y < wall.y + wall.height){
       toReturn = true;
     }
  }
  return toReturn;
}

function Wall(x, y, width, height){
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height; 
}

function redEdge(game){
  return game.width * game.redPercentage;
}
function blueEdge(game){
  return game.width - (game.width * game.bluePercentage);
}

function getEdgeOfHill(game, side){
  if(side === "right"){
    return game.hill.x + game.hill.size / 2;
  }else if (side === "left"){
    return game.hill.x - game.hill.size/2;
  }else if (side === "bottom"){
    return game.hill.y + game.hill.size/2;
  }else{
    return game.hill.y - game.hill.size/2;
  }

}

function Store(x, y, width, height){
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height; 
  this.sword_upgrades = [];
  this.sword_upgrades.push(new Sword("/public/stick.png", "Stick", 0.7, 8, 100, 0, 1));
  this.sword_upgrades.push(new Sword("/public/hammer.png", "Hammer", 1, 25, 100, 400, 3));
  this.sword_upgrades.push(new Sword("/public/iron_sword.png", "Iron Sword", 1, 15, 100, 800, 1));
  this.sword_upgrades.push(new Sword("/public/diamond_sword.png", "Diamond", 1.3, 18, 130, 1200, 1));
   this.sword_upgrades.push(new Sword("/public/ruby_sword.png", "Ruby Sword", 1.5, 20, 140, 1500, 1));
   this.sword_upgrades.push(new Sword("/public/dark_sword.png", "Dark Sword", 2.0, 18, 150, 2000, 0.8));
   this.bow_upgrades = [];
   var cross_bow = [];
   cross_bow[0] = "/public/bow_1.png";
   cross_bow[1] = "/public/bow2.png";
   cross_bow[2] = "/public/bow_3.png";
   this.bow_upgrades.push(new Bow(cross_bow, "Cross Bow", 1, 1, 500, 0));
    this.armor_upgrades = [];
    this.armor_upgrades.push(new Armor("/public/blank.png", "No Armor", 0, 0));
    this.armor_upgrades.push(new Armor("/public/iron_armor.png", "Iron Armor", 0.05, 500));
    this.armor_upgrades.push(new Armor("/public/gold_armor.png", "Gold Armor", 0.1, 800));
    this.armor_upgrades.push(new Armor("/public/diamond_armor.png", "Diamond Armor", 0.15, 1200));
    this.armor_upgrades.push(new Armor("/public/emerald_armor.png", "Emerald Armor", 0.2, 1500));
    this.armor_upgrades.push(new Armor("/public/ruby_armor.png", "Ruby Armor", 0.3, 1800));
    this.armor_upgrades.push(new Armor("/public/dark_armor.png", "Dark Armor", 0.5, 2400));
   
    

}
function Armor(path, name, reduced_damage, price){
  this.path = path
  this.name = name;
  this.reduced_damage = reduced_damage;
  this.image = undefined;
  this.price = price;
}

function Bow(img_path, name, attack_power, load_speed, attack_range, price){
  this.name = name;
  this.path = img_path;
  this.attack_power = attack_power;
  this.load_speed = load_speed;
  this.attack_range = attack_range;
  this.price  = price;
  this.image = [];
  this.knockback = 1;

}

function Sword(img_path, name, attack_power, attack_speed, attack_range, price, kb){
  this.name = name;
  this.description = "";
  this.path = img_path;
  this.attack_power = attack_power;
  this.attack_speed = attack_speed;
  this.attack_range = attack_range;
  this.image = undefined;
  this.price = price;
  this.knockback = kb;
}

function angle(cx, cy, ex, ey) {
var angleDeg = Math.atan2(ey - cy, ex - cx) * 180 / Math.PI;
return angleDeg;
}
function isPlayerInWall(player, game){
  var toReturn = false;
  for(w in game.walls){
    var wall = game.walls[w];
    if(intersectRect({left: player.x - player.size, right: player.x + player.size, top: player.y - player.size, bottom: player.y + player.size}, {left: wall.x, right: wall.x + wall.width, top: wall.y, bottom: wall.y + wall.height})){
      toReturn = true;
    }
  }
  return toReturn;
}
function sendMessageToNamespace(serverVAR, name, message, id){
      serverVAR.emit("client_message", {msg: name + ": " + message, id: id});
}
function wallCollisionAndResponse(player, game, info){
    if(isPlayerInWall(player, game)){
      var isXProblem = false;
      var isYProblem = false;
      //X-TEST
      for(var i = 0; i < 5; i++){
        player.x -= info.xIncrease * (0.1 * (i + 1));
        if(!isPlayerInWall(player, game)){
          isXProblem = true;
          break;
        }
      }

      if(!isXProblem){
      player.x += info.xIncrease;
      //Y-TEST
      for(var i = 0; i < 5; i++){
        player.y -= info.yIncrease * (0.1 * (i + 1));
        if(!isPlayerInWall(player, game)){
          isYProblem = true;
          break;
        }
      }
      if(!isYProblem){player.y += info.yIncrease;}

        while(isPlayerInWall(player, game)){
         player.x -= info.xIncrease * 0.1;
          player.y -= info.yIncrease * 0.1;
        }
      
      }
    }
    player.targetX = player.x;
    player.targetY = player.y;
}

function isPlayerOnHill(player, game, wall){
    var toReturn = false;
    if(intersectRect({left: player.x - player.size, right: player.x + player.size, top: player.y - player.size, bottom: player.y + player.size}, {left: wall.x - wall.size/2 + player.size, right: wall.x + wall.size/2 - player.size, top: wall.y - wall.size/2 + player.size, bottom: wall.y + wall.size/2 - player.size})){
      toReturn = true;
  }
  return toReturn;
}

function intersectRect(r1, r2) {
  return !(r2.left > r1.right || 
           r2.right < r1.left || 
           r2.top > r1.bottom ||
           r2.bottom < r1.top);
}

function playerLeaving(key, players, serverVAR){
  console.log("Player Leaving " + key);
    var player = findPlayer(players, key)
    if(player != undefined){
    players.splice(players.indexOf(player), 1);
   serverVAR.emit("playerUpdate", players);
    }
}

function performCollisionDetection(p, g){
    if(p.x + p.size > g.width){
      p.x = g.width - p.size - 1;
   }
    if(p.y + p.size > g.height){
      p.y = g.height - p.size - 1;
    }
    if(p.x - p.size < 0){
      p.x = p.size + 1;
    }
    if(p.y - p.size < 0){
      p.y = p.size + 1;
    }
    if(p.targetX + p.size > g.width){
      p.targetX = g.width - p.size - 1;
   }
    if(p.targetY + p.size > g.height){
      p.targetY = g.height - p.size - 1;
    }
    if(p.targetX - p.size < 0){
      p.targetX = p.size + 1;
    }
    if(p.targetY - p.size < 0){
      p.targetY = p.size + 1;
    }
    
}
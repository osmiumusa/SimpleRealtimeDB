var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');
var sqlite = require('sqlite3');

app.listen(4444);

function handler (req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }
    res.writeHead(200);
    res.end(data);
  });
}

var db = new sqlite.Database(":memory:");
db.run("CREATE TABLE data (key text primary key, value text)");

var datasocket = io.of("/data");

datasocket.on('connection', function (socket) {

  socket.on("updateObject", function (data) {
    db.get("SELECT * FROM data WHERE key = $key",{$key:data.key},function(err,row) {
      if(!row) { //Update shouldn't create
        datasocket.to(socket.id).emit("error",{error:"object_doesnt_exist",message:"Object doesn't exists"});
        return;
      }
      if(row.value==data.value) return; //Don't uselessly update
      db.run("UPDATE data SET value = $value WHERE key = $key", {
          $key: data.key,
          $value: data.value
      });
      datasocket.to(data.key).emit("updateObject",data); //Tell those who care
    });
  });

  socket.on("fetchObject", function(data) {
    db.get("SELECT * FROM data WHERE key = $key",{$key:data.key},function(err,row) { //Get the object
      datasocket.to(socket.id).emit("fetchObject",row); //Send it to whoever asked for it
    });
  });

  socket.on("createObject",function(data) {
    db.get("SELECT * FROM data WHERE key = $key",{$key:data.key},function(err,row) {
      if(row) {
        datasocket.to(socket.id).emit("error",{error:"object_exists",message:"Object already exists"});
        return;
      }
      db.exec("INSERT INTO data (key,value) VALUES ('"+data.key+"','"+data.value+"');");
      datasocket.emit("createObject",data);
    });
  });

  socket.on("deleteObject",function(data) {
    db.run("DELETE FROM data WHERE key=$key",{$key:data.key});
    datasocket.to(data.key).emit("deleteObject",data);
  });

  socket.on("subscribe",function(data){socket.join(data);});
  socket.on("unsubscribe",function(data){socket.leave(data);});

  socket.on("broadcast",function(data) {
    datasocket.emit("broadcast",data);
  });
});

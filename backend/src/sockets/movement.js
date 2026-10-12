module.exports.registerMovementHandlers = (io) => {

  io.on("connection", (socket) =>{
    console.log("User connected:", socket.id);

    socket.on("player:move",(data)=>{
      const {x,y} = data || {};

      // validation for coordinates
      if(
        typeof x !== "number" ||
        typeof y !== "number" ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ){
        return;
      }

      socket.broadcast.emit("player:moved",{
        socketId: socket.id,
        position: {x,y}
      });

       console.log(`Player ${socket.id} moved to (${x}, ${y})`);
    })

     socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });

  })
}
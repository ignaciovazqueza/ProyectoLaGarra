/*! \mainpage RobotArmController.js
 * */

var express = require('express'); /**< Referencia a la libreria express */
var app = express(); /**< Utiliza la libreria express */
var http = require("http").Server(app); /**< Referencia a la libreria http para crear un servidor */
var io = require("socket.io")(http); /**< Referencia a la libreria socket.io para conectarse con el cliente */
var Serialport = require('serialport'); /**< Referencia a la libreria serialport para setear la configuracion del puerto utilizado */
var math = require('mathjs'); /**< Referencia a la libreria mathjs */


var maxLimit; /**< Contiene la posicion maxima permitida */
var minLimit; /**< Contiene la posicion minima permitida */
var initialPos; /**< Contiene la posicion inicial del robot */
var currentPos; /**< Contiene la posicion actual del robot */
const topLeft = [40.0,0.0,75.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion de arriba a la izquierda utilizada */
const top = [0.0,0.0,75.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion de arriba al medio utilizada */
const topRight = [-40.0,0.0,75.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion de arriba a la derecha utilizada */
const bottom = [0.0,0.0,115.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion de abajo al medio utilizada */
const bottomLeft = [40.0,0.0,115.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion de abajo a la izquierda utilizada */
const bottomRight = [-40.0,0.0,115.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion de abajo a la derecha utilizada */
const center = [0.0,0.0,90.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion de centro absoluto utilizada */
const left = [40.0,0.0,90.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion del centro a la izquierda utilizada */
const right = [-40.0,0.0,90.0,0.0,0.0]; /**< Contiene las coordenadas para referenciarse a la posicion del centro a la derecha utilizada */


var Log = require('log'); /**< Referencia a la libreria log */
var log = new Log('debug'); /**< Utiliza la libreria log */
var port = process.env.PORT || 3000; /**< Contiene la referencia del puerto utilizado */

/*!
 *  \param myPort El nombre utilizado como primer parametro se puede obtener con el metodo listPorts()
 * */
var myPort = new Serialport('/dev/cu.wchusbserial1420', {
          baudRate: 9600,
          dataBits: 8,
          parity: "even",
          stopBits: 2,
          rtscts: true,
          parser: Serialport.parsers.readline("\n")
}); /**< Utiliza la libreria serialport para setear la configuracion del puerto utilizado. */





app.use(express.static(__dirname + "/public"));

app.get('/', function(req,res){
  res.redirect('index.html');
});

http.listen(port,function(){
  log.info('Servidor escuchando a traves del puerto %s',port);
});

myPort.on('open', onPortOpen);

io.sockets.on("connection",function(socket){
    //Associating the callback function to be executed when client visits the page and websocket connection is made 
      
      var message_to_client = {
        data:"Connection with the server established"
      }
      socket.send(JSON.stringify(message_to_client));
      //sending data to the client , this triggers a message event at the client side 

      console.log('Socket.io connection with the client established');
      initialCommands();
      socket.on("message",function(data){
        //This event is triggered at the server side when client sends the data using socket.send() method 
 
        data = JSON.parse(data);
        console.log(data.message);

        switch (data.message) {
            case "initialize":
                initialize();
                break;
            case "topLeft":
                moveAbsolute(topLeft);
                break;
            case "top":
                moveAbsolute(top);
                break;
            case "topRight":
                moveAbsolute(topRight);
                break;
            case "left":
                moveAbsolute(left);
                break;
            case "center":
                moveAbsolute(center);
                break;
            case "right":
                moveAbsolute(right);
                break;
            case "bottomLeft":
                moveAbsolute(bottomLeft);
                break;
            case "bottom":
                moveAbsolute(bottom);
                break;
            case "bottomRight":
                moveAbsolute(bottomRight);
                break;
        }

        //Printing the data 
        var ack_to_client = {
        data:"Server received the message"
      }
      socket.send(JSON.stringify(ack_to_client));
        //Sending the Acknowledgement back to the client , this will trigger "message" event on the clients side
    });
 
});





/*!
*   Imprime los puertos seriales disponibles.
* */
function listPorts(){
  Serialport.list(function (err, ports) {
    ports.forEach(function(port) {
      console.log(port.comName);
    });
  });
}

/*!
*   Se encarga de setear las variables pertinentes al brazo robotico y ejecutar los comandos iniciales para que comience el funcionamiento del mismo
* */
function onPortOpen() {
  setupArm();
  console.log("Port declared and opened");
  initialCommands();
}

/*!
*   Setea los valores que seran utilizados para el correcto funcionamiento del brazo robotico.
* */
function setupArm(){
  minLimit = [-90.0, -25.0, -45.0, -25.0, -10.0];
  maxLimit = [90.0, 25.0, 110.0, 25.0, 10.0];
  currentPos = [0.0, 0.0, 0.0, 0.0, 0.0];
  initialPos = [0.0, 0.0, 90.0, 0.0, 0.0];
  console.log("Setting up arm");
}

/*!
*   Setea los comandos iniciales que deberan ser ejecutados para el correcto funcionamiento del brazo robotico.
* */
function initialCommands(){
  var initArm = [
                "1;1;OPEN=NARCUSR"
                , "1;1;PARRLNG"
                , "1;1;PDIRTOP"
                , "1;1;PPOSF"
                , "1;1;PARMEXTL"
                , "1;1;KEYWDptest"
                , "1;1;SRVON"               
                , "1;1;RSTALRM"             
                , "1;1;STATE"
                , "1;1;CNTLON"             
                ];
  sendCommands(initArm);
}

/*!
*   Envia al puerto serie los comandos chequeados que se le pasan por parametro.
*   \param commands Es un arreglo que contiene los comandos que se le quieren mandar al brazo robotico.
* */
function sendCommands(commands){
  for (var i = 0; i < commands.length; i++) {
    console.log(commands[i]);
    myPort.write(commands[i]);
    myPort.write("\r");
  };
}

/*!
*   Mueve el brazo robotico a la posicion inicial seteada.
* */
function initialize(){
    moveAbsolute(initialPos);
}

/*!
*   Mueve el brazo robotico a una posicion absoluta.
*   \param angles Son las coordenadas representadas como arreglo de numeros que seran tomados como angulos para el brazo robotico.
* */
function moveAbsolute(angles){
    verifyMovement(angles, false);
}

/*!
*   Mueve el brazo robotico a una posicion relativa.
*   \param angles Son las coordenadas representadas como arreglo de numeros que seran tomados como angulos para el brazo robotico.
* */
function moveRelative(angles){
    verifyMovement(angles, true);
}

/*!
*   Verifica que el movimiento requerido esta dentro de los limites del alcance del brazo robotico para luego moverlo a la posicion pasada como parametro.
*   \param angles Son las coordenadas representadas como arreglo de numeros que seran tomados como angulos para el brazo robotico.
*   \param moveRelative Es un booleano que hace a referencia a un movimiento relativo si es verdadero o a un movimiento absoluto si es falso.
* */
function verifyMovement(angles,moveRelative){
    for (var i = 0; i < angles.length; i++) {
      if(moveRelative){
        currentPos[i] = math.min(math.max(currentPos[i] + angles[i],minLimit[i]),maxLimit[i]);
      }
      else {
        currentPos[i] = math.min(math.max(angles[i],minLimit[i]),maxLimit[i]);
      }
  }
    var point = format(currentPos);
    moveArm(point);
}

/*!
*   Formatea el conjunto de coordenadas pasadas como parametro para que los pueda interpretar de forma correcta el brazo robotico. 
*   \param angles Son las coordenadas representadas como arreglo de numeros que seran tomados como angulos para el brazo robotico.
* */
function format(angles) {
  var formattedAngles = '( ';
  for (var i = 0; i < angles.length-1; i++) {
    formattedAngles = formattedAngles + angles[i] + ',';
  };
  formattedAngles = formattedAngles + angles[angles.length-1] + ')';
  return formattedAngles;
}

/*!
*   Envia los comandos necesarios para que el robot se mueva a las coordenadas pasadas como parametro.
*   \param angles Son las coordenadas representadas como arreglo de numeros que seran tomados como angulos para el brazo robotico.
* */
function moveArm(angles){
    var command2Send = [ "1;1;EXECJCOSIROP = "+ angles
                        ,"1;1;EXECMOV JCOSIROP"
                       ];
    sendCommands(command2Send);
}
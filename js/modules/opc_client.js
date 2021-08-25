/*
* Author: Robin Garbe
* Version: 1.0.0
*/

module.exports = {
    init: () => {
        init();
    },
    connect: (address) => {
        connect(address);
    },
    send: (data) => {
        send(data);
    },
    close: () => {
        close();
    }
}

let sprint = process.sprint;
let show_error = process.show_error;
var shared = global.sharedObj;

const fs = require('fs');
const opcua = require("node-opcua");

const client = new opcua.OPCUAClient({
    connectionStrategy: {
        maxRetry: 3,
        initialDelay: 1000,
        maxDelay: 4 * 1000
    },
    keepSessionAlive: true,
    endpoint_must_exist: false
});
let session; // reference for the session
let client_ready = false;

function init() {
    process.setStatus("initialized",undefined,undefined,1);
    if ( shared.settings.opc.client.connection.fixed ) connect();
}

let connectedTo = "";
let last_backoff = 0;

function connect(address = "") {
    process.setStatus("connecting...",undefined,undefined,1);
    // Set the endpoint:
    let entpointUrl = "";
    let con = shared.settings.opc.client.connection;
    if ( con.fixed ) {
        if ( con.type === 1 ) {  // This PC
            endpointUrl = `opc.tcp://${require("os").hostname()}:${con.port}/${con.endpoint}`;
        } else if ( con.type === 2 ) {  // Local Network
            endpointUrl = `opc.tcp://${con.local}:${con.port}/${con.endpoint}`;
        } else if ( con.type === 3 ) {  // Internet
            endpointUrl = `opc.tcp://${con.internet}:${con.port}/${con.endpoint}`;
        }
    } else {
        endpointUrl = `opc.tcp://${address}`;
    }

    async function connectClient() {
        connectedTo = "init";
        try {
            function show_retry(last, difference) {
                if ( last_backoff < (last + difference - 1000) ) {
                    last_backoff = last + difference;
                    sprint("Retrying connection...","bred");
                    show_error("Wasn't able to connect to the OPC-server!<br>Retrying connection<span class='dotdotdot'></span>","warning");
                }
            }
            client.on("backoff", function () {
                if ( connectedTo === "init" ) {
                    let showtime = Math.floor(Math.random() * 200);
                    // show_error("Showtime: " + showtime, "debug noFade");
                    setTimeout(() => { show_retry(Math.floor(Date.now()), showtime) },showtime);
                }
            });
            await client.connect(endpointUrl);
            connectedTo = "connected";
            connectedTo = endpointUrl;
            session = await client.createSession();
            return true;
        } catch (err) {
            sprint("Error while connecting to the OPC-server! [" + err + "]","bred","black","bwhite","red");
            // show_error("Error while connecting to the OPC-server!<br><code>" + err + "</code>");
        }
    }
    connectClient().then((result) => {
        if ( result == true ) {
            client_ready = true;
            sprint("Client connected to OPC-server","green","bwhite","bwhite","green");
            show_error("Connected to OPC-server","success");
            process.setStatus("connected",undefined,undefined,2);
        } else {
            sprint("Warning: The client didn't connect correctly!","byellow","black","black","byellow");
            show_error("Can't connect to the server!");
            process.setStatus("can't connect",undefined,undefined,0);
        }
    });
}

function send(data) { // Send something to the OPC-server
    // Define the node to write to:
    const nodeId = "ns=1;s=" + JSON.parse(data).device_id;

    let newDataValue = data; // This variable will be send (should be a JSON)

    try {
        var nodeToWrite = [{
            nodeId: nodeId,
            attributeId: opcua.AttributeIds.Value,
            indexRange: null,
            value: {
                value: {
                    dataType: opcua.DataType.String,
                    value: newDataValue
                }
            }
        }];
        session.write(nodeToWrite, function(err,statusCode,diagnosticInfo) {
            if (!err) {
                let status = String(statusCode);
                if (status == "Good (0x00000)") {
                    sprint("Changes successful! - Status code: " + status, "green");
                    show_error("Sending successful!","success");
                } else {
                    sprint("Status code: " + status, "byellow");
                    show_error("Something went wrong while sending to the Hub-Server!<br>Status code: <code>" + status + "</code>","warning");
                }
            } else {
                sprint("Error while writing!!! Write unsuccessful with error:\n\n" + err,"bred","black","bwhite","red");
                show_error("Can't send order! The server may have disconnected<br><code>" + err + "</code>");
                close();
            }
            if (diagnosticInfo != undefined) {
                sprint("Diagnostic Info:\n" + String(diagnosticInfo), "byellow");
                show_error("Diagnostic Info:<br><code>" + String(diagnosticInfo) + "</code>","warning");
            }
        });
    } catch (err) {
        sprint("Error while writing!!! [" + err + "]","bred","black","bwhite","red");
        show_error("Error while sending!<br><code>" + err + "</code>");
    }
}

function close() { // Close the session and disconnect the client:
    connectedTo = "disconnected";
    try {
        if ( session != undefined ) {
            sprint("Closing session...","bred","bwhite","bwhite","red");
            // show_error("Closing session<span class='dotdotdot'></span>","warning");
            session.close();
        }
    } catch (err) {
        sprint("Warning: Wasn't able to close the session! (This warning may occur if the session has not been established yet) [" + err + "]","byellow","black","black","byellow");
        show_error("Wasn't able to close the session!<br><code>" + err + "</code>");
    }
    try {
        client.disconnect();
        sprint("Disconnected","bred","bwhite","bwhite","red");
        // setTimeout(() => { show_error("Disconnected","success") },100);
        process.setStatus("disconnected",undefined,undefined,0);
    } catch (err) {
        sprint("Warning: Wasn't able to disconnect the client! (This warning may occur if the client has not been initiated yet) [" + err + "]","byellow","black","black","byellow");
        show_error("Wasn't able to disconnect the client! (This error may occur if the client has not been initiated yet)<br><code>" + err + "</code>");
    }
}

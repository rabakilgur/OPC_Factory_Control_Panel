// First of all, get the settings:
console.log( "\n" );
const fs = require('fs');
const os = require("os");
const stringHash = require("string-hash");
const package = require('./package.json');
const getAppDataPath = require("appdata-path");
let blank_settings_path = __dirname + "\\settings_blank.json";
let app_path = getAppDataPath(package.productName);
let settings_path = app_path + "\\settings.json";
let settings;
if ( !fs.existsSync(settings_path) ) {  // If settings.json doesn't exist, create it by copying settings_blank.json
    fs.copyFileSync(blank_settings_path, settings_path);
    settings = JSON.parse(fs.readFileSync(settings_path, 'utf8'));
} else {  // If it does exist, check if it is complete by looking trough settings_blank.json
    let blank_settings = JSON.parse(fs.readFileSync(blank_settings_path, 'utf8'));
    let settings_string = fs.readFileSync(settings_path, 'utf8', err => {
        console.log( "ERROR WHILE READING SETTINGS.JSON\n", err );
    });
    settings = JSON.parse(settings_string);
    let anything_missing = false;
    Object.keys(blank_settings).forEach((key) => {
        if ( !settings.hasOwnProperty(key) ) {
            console.log("Doesn't have key: " + key);
            settings[key] = blank_settings[key];
            anything_missing = true;
        }
    });
    if ( anything_missing ) {
        console.log( "creating missing keys in settings.json:\n", settings );
        fs.writeFile(settings_path, JSON.stringify(settings, null, 4), (err) => { if (err) console.log("Error while saving the settings! [" + err + "]","bred","black","bwhite","red"); });
    }
}
if ( !fs.existsSync(app_path + "/orders") ) fs.mkdirSync(app_path + "/orders"); // If the "orders" forder doesn't exist, create it
devmode = (settings.devmode === true) ? true : false; // This should be set to 'false' for production. Disabling this will increase performance by turning some stuff off (like most console outputs)
const appmode = parseInt(settings.appmode); // 0=DeviceEnd, 1=SenderEnd
let computer_id = stringHash(os.hostname().replace(" ","") + os.networkInterfaces()[Object.keys(os.networkInterfaces())[0]][0].mac.replace(":",""));
if ( settings.id === null || !settings.id.startsWith("S_" + computer_id) ) {
    settings.id = "S_" + computer_id + Math.random().toString(36).substr(2).substr(0, 10);
    console.log( "Saving new ID: ", settings.id );
    fs.writeFile(settings_path, JSON.stringify(settings, null, 4), (x) => {});
}

// Include the console_print.js file and call it with "sprint(...)":
let console_print;
if (devmode) console_print = require('./js/modules/console_print');
process.sprint = function (text,fg,bg,sender_fg,sender_bg) {
    let appmode_name = "OPC";
    if      ( appmode === 0 ) appmode_name = "OPC-DeviceEnd";
    else if ( appmode === 1 ) appmode_name = "OPC-SenderEnd";
    if (devmode) console_print.print(appmode_name,text,fg,bg,sender_fg,sender_bg);
};
let sprint = process.sprint;

sprint("Starting...","byellow","black","black","byellow");


(() => {
    if ( (settings.startSender === true) && (appmode === 0) ) {
        setTimeout(() => {
            // Change the appmode to Sender-End and save it:
            settings.appmode = 1;  // Set the appmode to Sender-End
            jsonData = JSON.stringify(settings, null, 4);
            fs.writeFile(settings_path, jsonData, (err) => { if (err) console.log("Error while saving the settings! [" + err + "]","bred","black","bwhite","red"); });
            setTimeout(() => {
                sprint("Starting another window in Sender-End mode (not linked to this console)","bcyan","black","black","bcyan");
                // Spawn another Factory (in Sender-End mode):
                let {spawn} = require('child_process');
                let subprocess = spawn(process.argv[0], process.argv.slice(1), {detached: true}); // create a new instance of this program
                subprocess.unref();
                setTimeout(() => {
                    // Change the appmode back to its original state and save it again:
                    settings.appmode = appmode;
                    jsonData = JSON.stringify(settings, null, 4);
                    fs.writeFile(settings_path, jsonData, (err) => { if (err) console.log("Error while saving the settings! [" + err + "]","bred","black","bwhite","red"); });
                },3000);
            },1000);
        },3000);
    }
})();


const electron = require('electron');
const app = electron.app; // Module to control application life
const BrowserWindow = electron.BrowserWindow; // Module to create native browser window
const path = require('path');
const url = require('url');
const electron_reload = require('electron-reload')(__dirname, { electron: path.join(__dirname, 'node_modules', '.bin', 'electron'), ignored: /node_modules|settings\.txt|main\.js|[\/\\]\./ });

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true; // disables all electron security warings

// /\/\/\/\/\/\/\/\/\/\/\ OPC variables: /\/\/\/\/\/\/\/\/\/\/\
let opc_server = null; // global reference of the server object
let opc_client = null; // global reference of the client object
// /\/\/\/\/\/\/\/\/\/ End of OPC variables \/\/\/\/\/\/\/\/\/\


global.sharedObj = { // Define global/shared objects:
    devmode: devmode,
    appmode: appmode,
    settings: settings,
    package: package,
    app_path: app_path
};

function changeSharedObj(obj, value) {
    eval("global.sharedObj." + String(obj) + " = " + value); // change the global/shared variable
    mainWindow.webContents.executeJavaScript("updateSharedObj('" + String(obj) + "');"); // tell the FrontEnd that the variable was updated
}

const ipcMain = require('electron').ipcMain;
ipcMain.on('saveSettings', (e) => {
    if (devmode) console.log( "saving settings:\n", global.sharedObj.settings );
    jsonData = JSON.stringify(global.sharedObj.settings, null, 4);
    fs.writeFile(settings_path, jsonData, (err) => { if (err) console.log("Error while saving the settings! [" + err + "]","bred","black","bwhite","red"); });
});
ipcMain.on('restart', (e) => {
    sprint("Restarting... [This CLI session will close now]","bwhite","red");
    const {spawn} = require('child_process');
    const subprocess = spawn(process.argv[0], process.argv.slice(1), {detached: true}); // create a new instance of this program
    subprocess.unref();
    opc.close(); // stop the OPC server/client
    mainWindow.hide(); // Hide the initial window
    setTimeout(() => { process.exit(); },10000); // close the initial instance after 10s
});

let mainWindow = null; // global reference of the window object

process.show_error = function (text, type) {
    if ( type == undefined ) type = "error";
    function check_mainWindow(text, type) {
        if ( !(mainWindow === null)  ){
            try {
                mainWindow.webContents.executeJavaScript(`
                    function check_errorList(text, type) {
                        if ( $("#error-list").length ){
                            let error_id = "error" + Math.random().toString(36).substr(2).substr(0, 10);
                            $("#error-list").prepend('<div class="error-box ' + type + '" id="' + error_id + '"> <div class="error-inner"><div class="error-close"></div>' + text + '</div> </div>');
                            let thisError = $("#" + error_id);
                            clean_error_list()
                            setTimeout(() => { fadeOut_error(thisError) }, 5000);
                        } else {
                            setTimeout(() => { check_errorList(text, type) }, 300);
                        }
                    }
                    check_errorList("${text.replace(/"/g, '\\"')}", "${type}");
                `);
            } catch (err) {
                sprint("Can't show error [" + err + "]","yellow","black","black","yellow");
            }
        } else {
            setTimeout(() => { check_mainWindow(text, type) }, 300);
        }
    }
    check_mainWindow(text, type)
};
show_error = process.show_error;

process.setStatus = function (status, color, elem, state) {
    if ( color == undefined ) color = "#888";
    if ( elem == undefined )  elem  = "app-status";
    if ( state == undefined ) state = "";
    function check_mainWindow(status, color, elem, state) {
        if ( !(mainWindow === null) ){
            mainWindow.webContents.executeJavaScript(`
                function check_status(status, color, elem, state) {
                    if ( $("." + elem).length ) {
                        if ( $("." + elem).html() == "" ) {
                            $("." + elem).prepend('<span> - Status: <span>');
                        }
                        $("." + elem).attr('data-state', state);
                        $("." + elem).append('<span class="app-status-name" style="color:' + color + ';">' + status + '</span>');
                    } else {
                        setTimeout(() => { check_status(status, color, elem, state) }, 300);
                    }
                }
                check_status("${status}", "${color}", "${elem}", "${state}");
            `);
        } else {
            setTimeout(() => { check_mainWindow(status, color, elem, state) }, 300);
        }
    }
    check_mainWindow(status, color, elem, state)
}
setStatus = process.setStatus;

process.activity_indicator = function (indicator) {
    function check_mainWindow(indicator) {
        if ( !(mainWindow === null)  ){
            try {
                mainWindow.webContents.executeJavaScript(`
                    function check_indicator(indicator) {
                        if ( $(indicator).length ){
                            show_activity(indicator);
                        } else {
                            setTimeout(() => { check_indicator(indicator) }, 300);
                        }
                    }
                    check_indicator("${indicator}");
                `);
            } catch (err) {
                sprint("Can't show activity [" + err + "]","yellow","black","black","yellow");
            }
        } else {
            setTimeout(() => { check_mainWindow(indicator) }, 300);
        }
    }
    check_mainWindow(indicator)
};

function createWindow () {
    let w_width, w_height;
    if (devmode) {
        w_width = 1600; // window width for devmode (for DevTools)
        w_height = 800; // window height for devmode (for menu bar)
    } else {
        w_width = 1200; // default window width
        w_height = 800; // default window height
    }
    mainWindow = new BrowserWindow({ // Create the browser window
        width: w_width,
        height: w_height,
        minWidth: 1200,
        minHeight: 800,
        resizable: true,
        backgroundColor: "#242222",
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            allowRunningInsecureContent: false
        }
    });
    mainWindow.loadURL(url.format({ // load the index.html of the app
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))


    if (devmode) mainWindow.webContents.openDevTools(); // Open the DevTools
    else mainWindow.setMenu(null); // hides the menu bar at the top


    mainWindow.on('closed', function () { // Emitted when this window is closed
        opc.close();
        mainWindow = null;
    })
}

app.on('ready', () => {
    createWindow();
    sprint("Window created","green","black","black","byellow");

    if ( appmode === 0 ) {

        const publicIp = require('public-ip');
        (async () => {
        	global.sharedObj.settings.opc.server.address = await publicIp.v4();
        })();


        const opc_server = require("./js/modules/opc_server.js")
        opc = opc_server; // for the global reference
        opc_server.init();
    } else if ( appmode === 1 ) {
        const opc_client = require("./js/modules/opc_client.js")
        opc = opc_client; // for the global reference
        opc_client.init();
        global.sharedObj.connectOPC = "";
        global.sharedObj.sendOPC = null;

        ipcMain.on('connectOPC', (e) => {
            sprint( "connectOPC: " + global.sharedObj.connectOPC );
            opc_client.connect(global.sharedObj.connectOPC);
        });
        ipcMain.on('sendOPC', (e) => {
            sprint( "sendOPC: " + global.sharedObj.sendOPC );
            opc_client.send(global.sharedObj.sendOPC);
        });
        ipcMain.on('closeOPC', (e) => {
            sprint( "closeOPC" );
            opc_client.close();
        });
    }

})

// Some stuff for OS X:
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})
app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
})

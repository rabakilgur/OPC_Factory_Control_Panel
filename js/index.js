let process = remote.getGlobal('process'); // a reference to the process

// Set up the ipcRenderer (for events passing) and the shared variables:
const ipcRenderer = require('electron').ipcRenderer;
var shared = remote.getGlobal('sharedObj');
function updateSharedObj(obj) {
    let newObj = eval("remote.getGlobal('sharedObj')." + String(obj));
    console.log( `Updated value of "${String(obj)}": `, newObj );  // JUST FOR DEVELOPMENT!!!
}

$('title').text(shared.package.productName || shared.package.name); // Set the title of the window

// Show errors to the user:
let show_error = process.show_error;
function fadeOut_error(thisError) {
    if ( thisError.hasClass("noFade") ) return null;
    else if ( thisError.is(":hover") ) setTimeout(() => { fadeOut_error(thisError) }, 500);
    else fadeOut_error_now(thisError);
}
function fadeOut_error_now(thisError) {
    thisError.addClass("error-fadeOut");
    thisError.stop().animate({ height: "0" }, 1000);
    setTimeout(() => { thisError.remove() }, 1000);
}
function clean_error_list() {
    if ( (($("#error-layer").height() - 100) - $("#error-list").height()) < 0 ) {
        fadeOut_error_now($(".error-box:not(.error-fadeOut):last"));
        setTimeout(() => {
            if ( (($("#error-layer").height() - 100) - $("#error-list").height()) < 0 ) clean_error_list();
        }, 1000);
    }
}

// Load the device-end or sender-end scripts:
let loadScript = function(location){
    let fileRef = document.createElement('script');
    fileRef.setAttribute('type','text/javascript');
    fileRef.setAttribute('src', location);
    document.head.appendChild(fileRef);
};
if ( remote.getGlobal('sharedObj').appmode === 0 ) { // AppMode: DeviceEnd
    loadScript('./js/device-end.js');
} else if ( remote.getGlobal('sharedObj').appmode === 1 ) { // AppMode: SenderEnd
    loadScript('./js/sender-end.js');
}

$(document).ready(() => {

    // Vue.config.devtools = false; // Tell Vue that you don't won't to use the Vue-DevTools
    require('./js/modules/titlebar.js'); // Add functionality to the titlebar
    $(".app-title").text(shared.package.productName);
    $(".app-version").text(" - Version: " + shared.package.version);


    if (remote.getGlobal('sharedObj').devmode) {
        $(".preloader").remove();
        $(".content").addClass("no-preloader");
        $(".settings-dev").removeClass("settings-dev");
    }


    // Close an error-message when clicking on the close-button:
    $("#error-list").on("click", ".error-close", function () {
        let thisError = $(this).parent().parent();
        fadeOut_error_now(thisError);
    });


    $("#popup-background").click(() => {
        document.body.classList.remove("show_addDevice");
        document.body.classList.remove("show_deviceSettings");
        document.body.classList.remove("show_options");
        document.body.classList.remove("show_import");
    });
    $(".btn-close").click(() => {
        document.body.classList.remove("show_addDevice");
        document.body.classList.remove("show_deviceSettings");
        document.body.classList.remove("show_options");
        document.body.classList.remove("show_import");
    });


    $(".btn_reload").click(() => {
        location.reload();
    });
    $(".btn_restart").click(() => {
        setTimeout(() => {
            ipcRenderer.send('restart');
        },250);
    });
    $(".btn_save").click(() => {
        setTimeout(() => {
            show_error("Settings saved", "success");
            ipcRenderer.send('saveSettings');
        },100);
    });
    $(".btn_openAppFolder").click(() => {
        require("child_process").exec(`start "" "${shared.app_path}"`)
    });
    if ( shared.settings.devmode ) document.getElementById("switch_devMode").checked = true;
    if ( shared.settings.appmode === 1 ) document.getElementById("switch_senderMode").checked = true;
    if ( shared.settings.startSender ) document.getElementById("switch_startSender").checked = true;
    $("#settings-dataServer-address").val( shared.settings.dbserver );
    $("#settings-dataServer-address").on("input", function() {
        shared.settings.dbserver = $(this).val();
    });
    $("#settings-logServer-address").val( shared.settings.logserver.address );
    $("#settings-logServer-address").on("input", function() {
        shared.settings.logserver.address = $(this).val();
    });
    if ( shared.settings.opc.client.connection.fixed ) document.getElementById("switch_fixedConnection").checked = true;
    $("#switch_devMode").on("change", function() {
        if ( this.checked ) shared.settings.devmode = true;
        else shared.settings.devmode = false;
    }).trigger("change");
    $("#switch_senderMode").on("change", function() {
        if ( this.checked ) {
            shared.settings.appmode = 1;
            $("#switch_startSender").parent().addClass("settings-disabled");
        } else {
            shared.settings.appmode = 0;
            $("#switch_startSender").parent().removeClass("settings-disabled");
        }
    }).trigger("change");
    $("#switch_startSender").on("change", function() {
        if ( this.checked ) shared.settings.startSender = true;
        else shared.settings.startSender = false;
    }).trigger("change");
    $("#switch_fixedConnection").on("change", function() {
        if ( this.checked ) {
            $(".settings-fixedConnection").removeClass("settings-disabled");
            shared.settings.opc.client.connection.fixed = true;
        } else {
            $(".settings-fixedConnection").addClass("settings-disabled");
            shared.settings.opc.client.connection.fixed = false;
        }
    }).trigger("change");
	if ( shared.settings.opc.client.connection.type == 1 ) {
		setTimeout(() => { $('.settings-radioLabel[for="settings-sender-radio1"]').click() }, 100);
	} else if ( shared.settings.opc.client.connection.type == 2 ) {
        setTimeout(() => { $('.settings-radioLabel[for="settings-sender-radio2"]').click() }, 100);
	} else if ( shared.settings.opc.client.connection.type == 3 ) {
		setTimeout(() => { $('.settings-radioLabel[for="settings-sender-radio3"]').click() }, 100);
	}
    $('.settings-radioLabel[for="settings-sender-radio1"]').click(() => {
        shared.settings.opc.client.connection.type = 1;
        $(".settings-addressBox").attr("data-showadress","1");
    });
    $('.settings-radioLabel[for="settings-sender-radio2"]').click(() => {
        shared.settings.opc.client.connection.type = 2;
        $(".settings-addressBox").attr("data-showadress","2");
    });
    $('.settings-radioLabel[for="settings-sender-radio3"]').click(() => {
        shared.settings.opc.client.connection.type = 3;
        $(".settings-addressBox").attr("data-showadress","3");
    });
    $("#settings-addressThisPC").text( require("os").hostname() );
    $("#settings-addressLocal").val( shared.settings.opc.client.connection.local );
    $("#settings-addressInternet").val( shared.settings.opc.client.connection.internet );
    $("#settings-addressLocal").on("input", function() {
        shared.settings.opc.client.connection.local = $(this).val();
    });
    $("#settings-addressInternet").on("input", function() {
        shared.settings.opc.client.connection.internet = $(this).val();
    });

    $("#settings-server-name").val( shared.settings.opc.server.name );
    $("#settings-server-port").val( shared.settings.opc.server.port );
    $("#settings-server-endpoint").val( shared.settings.opc.server.endpoint );
    $("#settings-server-name").on("input", function() {
        shared.settings.opc.server.name = $(this).val();
    });
    $("#settings-server-port").on("input", function() {
        shared.settings.opc.server.port = $(this).val();
    });
    $("#settings-server-endpoint").on("input", function() {
        shared.settings.opc.server.endpoint = $(this).val();
    });


    // Import Settings:
    window.ondragover = function(e) { e.preventDefault(); return false };  // prevent default behavior from changing page on dropped file
    window.ondrop = function(e) { e.preventDefault(); return false };  // NOTE: ondrop events WILL NOT WORK if you do not "preventDefault" in the ondragover event!

    const holder = document.body;
    let last_hovered = 0;
    holder.ondragover = function (e) {
        if ( last_hovered < ((+ new Date()) - 100) ) {
            last_hovered = (+ new Date());
            setTimeout(() => {
                if ( last_hovered < ((+ new Date()) - 250) ) {
                    $(document.body).removeClass("show_import");
                    console.log("dragover timeout");
                }
            },400);
            $(document.body).addClass("show_import");

            console.log("dragover");

            return false;
        }

    };
    holder.ondrop = function (e) {
        e.preventDefault();
        last_hovered = ((+ new Date()) + 500);
        $(document.body).addClass("show_import");

        let file_path = e.dataTransfer.files[0].path;
        console.log("ondrop: ", file_path);

        if ( file_path.split("\\")[file_path.split("\\").length - 1] == "settings.json"  ) {
            $(".importSettings-box").attr("data-status","valid");
        } else {
            $(".importSettings-box").attr("data-status","invalid");
            setTimeout(() => {
                if ( $(".importSettings-box").attr("data-status") === "invalid" ) {
                    $(document.body).removeClass("show_import");
                    setTimeout(() => { $(".importSettings-box").attr("data-status","init") }, 200);
                }
            },3000);
        }


        return false;
    };
});




// -----------------------------------------------------------------------------
// ------------------------------  Unused Stuff:  ------------------------------
// -----------------------------------------------------------------------------

/* * *
  Stuff with the shared variables:
* * */
/*
// show initial value from main process (in dev console)
let my_prop1 = remote.getGlobal('sharedObj').prop1;
console.log( "Initial Value: " + remote.getGlobal('sharedObj').prop1 );

// change value of global prop1
remote.getGlobal('sharedObj').prop1 = 125;

// show changed value in main process (in stdout, as a proof it was changed)
// var ipcRenderer = require('electron').ipcRenderer;
// ipcRenderer.send('show-prop1');

// show changed value in renderer process (in dev console)
console.log( "Updated Value: " + remote.getGlobal('sharedObj').prop1 );
*/


/* * *
  body file drop (API example):
* * */
/*
const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}
const emitter = new MyEmitter();

document.ondragover = document.ondrop = (ev) => {
    ev.preventDefault();
}
document.body.ondrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0].path;
    emitter.emit('document-drop', {
        file
    })
}
emitter.on('document-drop', (data) => {
    console.log('Dropped ' + data.file);
});
*/


/* * *
  Encapsulation example:
* * */
/*
(() => {
    // This is encapsulated
})();
*/

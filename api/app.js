var https = require('https');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var firebase = require('firebase');
var crypto = require('crypto');
var Guid = require('guid');

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use( bodyParser.urlencoded( {     // to support URL-encoded bodies
  extended: true
}));

app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies

// Initialize Firebase
var config = {
    apiKey: "AIzaSyC-WlVZO0zLTV6wHB6Wy2KsW1F28z837Hg",
    authDomain: "goodsamaritan-hackuta.firebaseapp.com",
    databaseURL: "https://goodsamaritan-hackuta.firebaseio.com",
    projectId: "goodsamaritan-hackuta",
    storageBucket: "goodsamaritan-hackuta.appspot.com",
    messagingSenderId: "42397767683"
};
firebase.initializeApp(config);

var database = firebase.database();

// pubic variables
var takenEmails = new Array();

// start listening
var server = app.listen(8080, () => console.log("running on port 8080"));

// create callback to keep the takenEmails array up to date
database.ref('users').on('child_added', function(snapshot, prevKey) {
    console.log('account added: ' + snapshot.val().email);
    takenEmails.push(snapshot.val().email);
});
database.ref('users').on('child_removed', function(snapshot) {
    if(snapshot != undefined && snapshot != null) {
        console.log('account removed: ' + shapshot.val().email);
        remove(takenEmails, shapshot.val().email);
    }
    else {
        takenEmails = new Array();
    }
});

/*
 * POST /user
 * create a user
 */
app.post('/user', function(request, response) {

    // body to get data
    var body = request.body;

    // check that the request has needed data
    if(!checkProperties(body, ['first_name', 'last_name', 'email', 'password'])) {
        response.statusCode = 400;
        response.send('Missing or invalid parameters');
        return;
    }

    // validate parameters
    // check if email is taken
    for(var i = 0; i < takenEmails.length; i++) {
        if(body.email == takenEmails[i]) {
            response.statusCode = 400;
            response.send('An account with this email already exists');
            return;
        }
    }

    // create the user object
    var now = new Date();
    var user = {
        email: body.email,
        password: crypto.createHash('md5').update(body.password).digest("hex"),
        date_created: (now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear()),
        first_name: body.first_name,
        last_name: body.last_name,
        points: 0
    };

    // add user to firebase database

    database.ref('users/' + urlSafeString(body.email)).set(user);

    // return user
    // set response type
    //response.setHeader('Content-Type', 'application/json');
    response.send(user);
    return;
});

/*
    GET /user
    gets a user from firebase
*/
app.get('/user', function(request, response) {

    // get the email and password
    var email = request.query.email;
    var password = request.query.password;

    getUsers(function(users) {
        // check email and password
        var hash_pass = crypto.createHash('md5').update(password).digest('hex');
        var user = users[urlSafeString(email)];
        if(user == undefined || user == null) {
            response.statusCode = 404;
            response.send('User not found');
        }
        else if(user.password == hash_pass) {
            // the user is authenticated
            response.setHeader('Content-Type', 'application/json');
            response.send(user);
        }
        else {
            response.statusCode = 401;
            response.send('Invalid password');
        }
    });

});

/*
    POST /needing - posts a need request
*/
app.post('/needing', function(request, response) {

    var body = request.body;

    // check that all the json properties are satisfied
    if(!checkProperties(body, ['email', 'name', 'type', 'title', 'desc'])) {
        response.statusCode = 400;
        response.send('Missing or invalid parameters');
        return;
    }

    // push to needs
    var guid = Guid.create();
    var need = {
        email: body.email,
        name: body.name,
        type: body.type,
        title: body.title,
        desc: body.desc,
        quantity: body.quantity
    }

    database.ref('/needs/' + guid).set(need);

    // respond
    response.send(need);
    return;
});

/*
    GET /needing - gets the need requests
*/
app.get('/needing', function(request, response) {
    getNeeds(function(needs) {
        if(needs == undefined || needs == null) {
            response.statusCode = 404;
            response.send('Needs not found');
            return;
        }
        else {
            response.setHeader('Content-Type', 'application/json');
            response.send(needs);
            return;
        }
    });
});

/*
    POST /offering - post things that you have
*/
app.post('/offering', function(request, response) {
    var body = request.body;

    // check properties
    if(!checkProperties(body, ['email', 'name', 'title', 'desc'])) {
        // return 400 for invalid parameters
        response.statusCode = 400;
        response.send('Missing or invalid parameters');
        return;
    }

    // create supply
    var guid = Guid.create();
    var supply = {
        email: body.email,
        name: body.name,
        title: body.title,
        desc: body.desc
    };

    // post supply
    database.ref('supplies/' + guid).set(supply);
    response.setHeader('Content-Type', 'application/json');
    response.send(supply);
    return;
});

/*
    GET /offering - get all offerings
*/
app.get('/offering', function(request, response) {
    getSupplies(function(supplies) {
        if(supplies == undefined || supplies == null) {
            response.statusCode = 404;
            response.send('Supplies not found');
            return;
        }
        else {
            response.setHeader('Content-Type', 'application/json');
            response.send(supplies);
            return;
        }
    });
});

/*
    DELETE methods
*/
app.delete('/needing', function(request, response) {
    var id = request.query.id;
    if(id == undefined) {
        response.statusCode = 400;
        response.send('Missing or invalid parameters');
        return;
    }
    else {
        database.ref('needs/' + id).remove();
        response.send('Item removed');
        return;
    }
});
app.delete('/offering', function(request, response) {
    var id = request.query.id;
    if(id == undefined) {
        response.statusCode = 400;
        response.send('Missing or invalid parameters');
        return;
    }
    else {
        database.ref('supplies/' + id).remove();
        response.send('Item removed');
        return;
    }
});
app.delete('/user', function(request, response) {
    var email = request.query.email;
    var password = request.query.password;

    if(email == undefined || password == undefined) {
        response.statusCode = 400;
        response.send('Missing or invalid parameters');
        return;
    }
    else {
        // check password
        var hash_pass = crypto.createHash('md5').update(password).digest('hex');
        getUsers(function(users) {
            var user = users[urlSafeString(email)];
            if(user == undefined) {
                response.statusCode = 404;
                response.send('User not found.');
                return;
            }
            else if(user.password == hash_pass) {
                // delete the user
                database.ref('users/' + urlSafeString(email)).remove();
                response.send('Item removed');
                return;
            }
            else {
                // unauthorized
                response.statusCode = 401;
                response.send('Invalid password');
                return;
            }
        });
    }
});


// HELPER FUNCTIONS
function remove(array, elem) {
    for(var i = 0; i < array.length; i++) {
        if(array[i] == elem) {
            array.splice(i, 1);
        }
    }
}

function urlSafeString(str) {
    str = str.split('@').join('z');
    return str.split('.').join('z');
}

function checkProperties(json, params) {
    for(var i = 0; i < params.length; i++) {
        if(!json.hasOwnProperty(params[i])) return false;
    }
    return true;
}

function getData(url, callback) {
    https.get(url, (response) => {
        var data = '';
        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            callback(JSON.parse(data));
        });
    });
}

function getUsers(callback) {
    getData('https://goodsamaritan-hackuta.firebaseio.com/users.json', callback);
}

function getNeeds(callback) {
    getData('https://goodsamaritan-hackuta.firebaseio.com/needs.json', callback);
}

function getSupplies(callback) {
    getData('https://goodsamaritan-hackuta.firebaseio.com/supplies.json', callback);
}
